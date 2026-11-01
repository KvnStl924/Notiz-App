import { useEffect, useState } from 'preact/hooks';
import { importMarkdown } from './import';
import type { Note } from './model';
import { store } from './store';
import { sync } from './sync/manager';

/** Rezept-Eingang aus der gemeinsamen, öffentlich lesbaren Google-Tabelle. */

const KEY = 'notiz.inbox.v1';
/** Alle ~1 s eine winzige Abfrage (nur die Zeilenanzahl); die ganze Tabelle nur bei Änderung. */
const POLL_MS = 1_000;
/** Zur Sicherheit auch ohne erkannte Änderung ab und zu die ganze Tabelle laden. */
const FULL_EVERY_MS = 60_000;
/** Nach einem Fehler (z. B. offline) seltener nachfragen. */
const RETRY_AFTER_ERROR_MS = 5_000;
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

/** Antwort auf `select count(C)` (CSV: Kopfzeile, dann die Zahl). */
export function parseCount(csv: string): number | null {
  const rows = parseCsv(csv);
  const n = rows.length > 1 ? Number(rows[1][0]) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
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
  private lastCount: number | null = null;
  /** Anzahl der Rezepte beim letzten vollen Abruf: Vergleichswert für die erste leichte Abfrage */
  private fullRowCount: number | null = null;
  private lastFull = 0;
  private retryAt = 0;

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
      void this.quickCheck().finally(() => this.schedulePoll());
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

  private url(query = '') {
    return `https://docs.google.com/spreadsheets/d/${this.saved!.sheetId}/gviz/tq?tqx=out:csv${query}`;
  }

  /** Nur die Anzahl der Rezepte in der Tabelle (winzige Antwort). */
  private async fetchCount(): Promise<number> {
    const res = await fetch(this.url('&tq=' + encodeURIComponent('select count(C)')), { cache: 'no-store' });
    const n = res.ok && (res.headers.get('content-type') ?? '').includes('csv') ? parseCount(await res.text()) : null;
    if (n === null) throw new Error('keine Zahl');
    return n;
  }

  /**
   * Leichte Prüfung im Sekundentakt: Ändert sich die Anzahl der Rezepte in der Tabelle,
   * wird sofort alles geladen und übernommen. Dazu sicherheitshalber alle 60 s eine volle Prüfung.
   */
  private async quickCheck() {
    if (!this.saved || this.running || Date.now() < this.retryAt) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (sync.saved && sync.view !== 'online') return;
    try {
      const count = await this.fetchCount();
      const base = this.lastCount ?? this.fullRowCount;
      const changed = base === null || count !== base;
      this.lastCount = count;
      if (changed || Date.now() - this.lastFull > FULL_EVERY_MS) await this.check();
    } catch {
      this.lastCount = null;
      this.fullRowCount = null;
      await this.check(); // meldet den Fehler und setzt den Status
      if ((this.status as InboxStatus) === 'error') this.retryAt = Date.now() + RETRY_AFTER_ERROR_MS;
    }
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
      const res = await fetch(this.url(), { cache: 'no-store' });
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
      this.lastFull = Date.now();
      this.fullRowCount = rows.length;
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
