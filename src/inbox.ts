import { useEffect, useState } from 'preact/hooks';
import { importMarkdown } from './import';
import type { Note } from './model';
import { store } from './store';
import { sync } from './sync/manager';

/** Rezept-Eingang aus der gemeinsamen, öffentlich lesbaren Google-Tabelle. */

const KEY = 'notiz.inbox.v1';
const POLL_MS = 5_000;
const DEFAULT_SHEET_ID = '1cGwVzjOz1QfMTnONgrWyFYucLpNwrzvHkaMNtPJ3rcE';

interface Saved {
  sheetId: string;
  /** IDs bereits übernommener Zeilen (auch gelöschte Rezepte tauchen so nicht wieder auf) */
  imported: string[];
  lastCheck?: number;
}

export interface InboxRow {
  title: string;
  markdown: string;
}

/** Tabellen-ID aus einem Google-Tabellen-Link (oder die ID selbst). */
export function parseSheetId(input: string): string | null {
  const m = input.match(/\/d\/([A-Za-z0-9_-]{20,})/) ?? input.trim().match(/^([A-Za-z0-9_-]{25,})$/);
  return m ? m[1] : null;
}

/** CSV nach RFC 4180: Anführungszeichen, doppelte Anführungszeichen und Zeilenumbrüche in Zellen. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** Zeilen der Tabelle: Kopfzeile und leere Zeilen werden übersprungen. */
export function rowsFromCsv(csv: string): InboxRow[] {
  const out: InboxRow[] = [];
  for (const r of parseCsv(csv)) {
    const [zeit = '', titel = '', rezept = ''] = r;
    if (zeit.trim().toLowerCase() === 'zeit' && titel.trim().toLowerCase() === 'titel') continue;
    if (!rezept.trim()) continue;
    out.push({ title: titel.trim(), markdown: rezept });
  }
  return out;
}

async function sha(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Macht aus einer Zeile ein Rezept. Die IDs ergeben sich aus dem Inhalt: Prüfen beide Handys
 * gleichzeitig, entsteht dasselbe Rezept mit denselben Blöcken (kein Doppeltes).
 */
export async function noteFromRow(row: InboxRow): Promise<Note | null> {
  const note = importMarkdown(row.markdown, 'recipe');
  if (!note) return null;
  if (note.title === 'Ohne Titel' && row.title) note.title = row.title;
  const id = (await sha(row.title + '\n' + row.markdown)).slice(0, 16);
  note.id = id;
  for (let i = 0; i < note.blocks.length; i++) note.blocks[i].id = (await sha(`${id}:${i}`)).slice(0, 16);
  return note;
}

export type InboxStatus = 'off' | 'idle' | 'checking' | 'error';

class Inbox {
  saved: Saved | null = null;
  status: InboxStatus = 'off';
  error = '';
  /** Zuletzt übernommenes Rezept (für den Hinweis in der App) */
  notice: { id: string; title: string } | null = null;
  private listeners = new Set<() => void>();
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((l) => l());
  }
  private persist() {
    try {
      if (this.saved) localStorage.setItem(KEY, JSON.stringify(this.saved));
      else localStorage.removeItem(KEY);
    } catch {
      /* Speicher nicht verfügbar */
    }
  }

  start() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) this.saved = JSON.parse(raw) as Saved;
    } catch {
      /* ignorieren */
    }
    if (!this.saved) {
      this.saved = { sheetId: DEFAULT_SHEET_ID, imported: [] };
      this.persist();
    }
    this.status = this.saved ? 'idle' : 'off';
    this.notify();
    if (typeof document === 'undefined') return;
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);
    if (document.visibilityState === 'visible') void this.check();
    this.schedulePoll();
  }

  private onVisibilityChange = () => {
    if (document.visibilityState !== 'visible') {
      if (this.pollTimer) clearTimeout(this.pollTimer);
      this.pollTimer = null;
      return;
    }
    void this.check().finally(() => this.schedulePoll());
  };

  /** Poll only while the app is visible; resume with an immediate check. */
  private schedulePoll() {
    if (this.pollTimer) clearTimeout(this.pollTimer);
    this.pollTimer = null;
    if (!this.saved || typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.check().finally(() => this.schedulePoll());
    }, POLL_MS);
  }

  /** Tabelle verbinden und gleich prüfen. Gibt eine Fehlermeldung zurück, wenn es nicht klappt. */
  async connect(input: string): Promise<string | null> {
    const sheetId = parseSheetId(input);
    if (!sheetId) return 'Das sieht nicht nach einem Link zu einer Google-Tabelle aus.';
    this.saved = { sheetId, imported: [] };
    this.persist();
    this.status = 'idle';
    this.notify();
    await this.check(true);
    this.schedulePoll();
    if ((this.status as InboxStatus) === 'error') {
      const msg = this.error;
      this.saved = null;
      this.persist();
      this.status = 'off';
      this.notify();
      return msg;
    }
    return null;
  }

  disconnect() {
    this.saved = null;
    this.persist();
    this.status = 'off';
    this.error = '';
    this.notify();
  }

  clearNotice() {
    this.notice = null;
    this.notify();
  }

  /** Neue Zeilen der Tabelle als Rezepte übernehmen. */
  async check(force = false) {
    if (!this.saved || this.running) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    // Ist ein gemeinsamer Bereich eingerichtet, erst nach dem ersten Abgleich importieren,
    // sonst legen beide Handys dasselbe Rezept an.
    if (!force && sync.saved && sync.view !== 'online') return;
    this.running = true;
    this.status = 'checking';
    this.notify();
    try {
      const url = `https://docs.google.com/spreadsheets/d/${this.saved.sheetId}/gviz/tq?tqx=out:csv`;
      const res = await fetch(url, { cache: 'no-store' });
      const type = res.headers.get('content-type') ?? '';
      if (!res.ok || !type.includes('csv')) throw new Error('nicht lesbar');
      const rows = rowsFromCsv(await res.text());
      for (const row of rows) {
        const note = await noteFromRow(row);
        if (!note) continue;
        const known = this.saved.imported.includes(note.id) || store.get(note.id) || sync.engine?.knows(note.id);
        if (!known) {
          store.save(note);
          const n = (this.notice = { id: note.id, title: note.title });
          setTimeout(() => this.notice === n && this.clearNotice(), 8000);
        }
        if (!this.saved.imported.includes(note.id)) this.saved.imported.push(note.id);
      }
      this.saved.lastCheck = Date.now();
      this.persist();
      this.error = '';
      this.status = 'idle';
    } catch {
      this.error =
        'Die Tabelle lässt sich nicht lesen. Ist sie bei Google auf „Jeder mit dem Link“ (Betrachter) gestellt und der Link vollständig?';
      this.status = 'error';
    } finally {
      this.running = false;
      this.notify();
    }
  }
}

export const inbox = new Inbox();

export function useInbox() {
  const [, set] = useState(0);
  useEffect(() => {
    const off = inbox.subscribe(() => set((v) => v + 1));
    set((v) => v + 1);
    return off;
  }, []);
  return inbox;
}
