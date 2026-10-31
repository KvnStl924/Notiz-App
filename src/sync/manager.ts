import { useEffect, useState } from 'preact/hooks';
import { newId } from '../model';
import { shop, store } from '../store';
import { SyncEngine, type SyncStatus } from './engine';
import type { FirebaseConfig } from './firestore-backend';

const KEY = 'notiz.sync.v1';
const CONFIG_KEY = 'notiz.firebase.v1';

interface Saved {
  space: string;
  name: string;
  clientId: string;
}

const mem = new Map<string, string>();
const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return mem.get(k) ?? null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      mem.set(k, v);
    }
  },
  del: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      mem.delete(k);
    }
  },
};

const randomHex = (bytes: number) => {
  const b = new Uint8Array(bytes);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
};

/** Zieht den Bereichs-Code aus einem Link oder einem eingefügten Code (mind. 24 Zeichen, 0-9 a-f). */
export function parseSpaceCode(input: string): string | null {
  const m = input.trim().match(/([0-9a-f]{24,64})\s*$/i);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Liest den Konfigurationsblock aus der Firebase-Konsole („const firebaseConfig = { apiKey: …, projectId: … }“)
 * oder ein JSON mit denselben Feldern. Gibt null zurück, wenn apiKey oder projectId fehlen.
 */
export function parseFirebaseConfig(text: string): FirebaseConfig | null {
  const k = text.indexOf('apiKey');
  if (k < 0) return null;
  const start = text.lastIndexOf('{', k);
  const end = text.indexOf('}', k);
  if (start < 0 || end < 0) return null;
  const body = text
    .slice(start, end + 1)
    .replace(/\/\/.*$/gm, '') // Kommentare
    .replace(/'/g, '"')
    .replace(/([{,]\s*)([A-Za-z_]\w*)\s*:/g, '$1"$2":') // Schlüssel in Anführungszeichen
    .replace(/,\s*}/g, '}');
  try {
    const o = JSON.parse(body) as FirebaseConfig;
    return o && typeof o.apiKey === 'string' && typeof o.projectId === 'string' ? o : null;
  } catch {
    return null;
  }
}

export type SyncView = 'unavailable' | 'local' | SyncStatus;

/**
 * Verwaltet den gemeinsamen Bereich: ob Sync eingerichtet ist, wer man ist und die Verbindung.
 * Ohne `firebase-config.json` bleibt die App rein lokal.
 */
class SyncManager {
  available = false;
  saved: Saved | null = null;
  engine: SyncEngine | null = null;
  /** Code aus einem Einladungslink, der noch bestätigt werden muss */
  pendingJoin: string | null = null;
  panelOpen = false;
  private config: FirebaseConfig | null = null;
  private listeners = new Set<() => void>();
  private unsubEngine?: () => void;

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((l) => l());
  }

  async init() {
    try {
      const raw = ls.get(KEY);
      if (raw) this.saved = JSON.parse(raw) as Saved;
    } catch {
      /* ignorieren */
    }
    // Einladungslink: #join-<Code>
    const m = location.hash.match(/^#join-([0-9a-f]{24,64})$/i);
    if (m) {
      this.pendingJoin = m[1].toLowerCase();
      try {
        history.replaceState(null, '', location.pathname + location.search);
      } catch {
        /* ignorieren */
      }
    }
    // 1) in der App eingefügte Konfiguration, 2) Datei firebase-config.json neben der App
    try {
      const raw = ls.get(CONFIG_KEY);
      const cfg = raw ? (JSON.parse(raw) as FirebaseConfig) : null;
      if (cfg && cfg.projectId && cfg.apiKey) {
        this.config = cfg;
        this.available = true;
      }
    } catch {
      /* ignorieren */
    }
    if (!this.available) {
      try {
        const res = await fetch('/firebase-config.json', { cache: 'no-cache' });
        if (res.ok) {
          const cfg = (await res.json()) as FirebaseConfig;
          if (cfg && cfg.projectId && cfg.apiKey) {
            this.config = cfg;
            this.available = true;
          }
        }
      } catch {
        /* keine Konfiguration: Einrichtung über das Personen-Symbol */
      }
    }
    if (this.available && (this.pendingJoin || !this.saved)) this.panelOpen = this.pendingJoin !== null || !ls.get(KEY + '.dismissed');
    this.notify();
    if (this.available && this.saved) await this.connect();
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && this.engine?.flushAll());
    }
  }

  private async connect() {
    if (!this.config || !this.saved) return;
    this.disconnect();
    const { createFirestoreBackend } = await import('./firestore-backend');
    const backend = createFirestoreBackend(this.config, this.saved.space, { persistent: true });
    const engine = new SyncEngine(store, shop, backend, { clientId: this.saved.clientId, name: this.saved.name });
    this.engine = engine;
    this.unsubEngine = engine.subscribe(() => this.notify());
    this.notify();
    await engine.start();
    this.notify();
  }

  private disconnect() {
    this.unsubEngine?.();
    this.engine?.stop();
    this.engine = null;
  }

  private persist() {
    if (this.saved) ls.set(KEY, JSON.stringify(this.saved));
    else ls.del(KEY);
  }

  /** Firebase-Konfiguration aus dem eingefügten Text übernehmen. */
  setConfig(text: string): boolean {
    const cfg = parseFirebaseConfig(text);
    if (!cfg) return false;
    ls.set(CONFIG_KEY, JSON.stringify(cfg));
    this.config = cfg;
    this.available = true;
    this.notify();
    return true;
  }

  async create(name: string) {
    this.saved = { space: randomHex(16), name: name.trim(), clientId: newId() };
    this.persist();
    this.panelOpen = false;
    await this.connect();
  }

  async join(codeOrLink: string, name: string) {
    const code = parseSpaceCode(codeOrLink);
    if (!code) throw new Error('Das ist kein gültiger Einladungslink.');
    this.saved = { space: code, name: name.trim(), clientId: this.saved?.clientId ?? newId() };
    this.pendingJoin = null;
    this.persist();
    this.panelOpen = false;
    await this.connect();
  }

  /** Name ändern (wird auch den anderen angezeigt). */
  rename(name: string) {
    if (!this.saved || !name.trim()) return;
    this.saved.name = name.trim();
    if (this.engine) this.engine.me.name = this.saved.name;
    this.persist();
    this.notify();
  }

  /** Bereich verlassen: lokale Daten bleiben auf diesem Gerät. */
  leave() {
    this.disconnect();
    this.saved = null;
    this.persist();
    this.notify();
  }

  dismissOnboarding() {
    ls.set(KEY + '.dismissed', '1');
    this.panelOpen = false;
    this.notify();
  }
  openPanel(open: boolean) {
    this.panelOpen = open;
    this.notify();
  }

  inviteLink(): string {
    return this.saved ? `${location.origin}${location.pathname}#join-${this.saved.space}` : '';
  }

  get view(): SyncView {
    if (!this.available) return 'unavailable';
    if (!this.saved) return 'local';
    return this.engine?.status ?? 'connecting';
  }
}

export const sync = new SyncManager();

/** Rendert neu, wenn sich der Sync-Zustand ändert. */
export function useSync() {
  const [, set] = useState(0);
  useEffect(() => {
    const off = sync.subscribe(() => set((v) => v + 1));
    set((v) => v + 1); // Änderungen zwischen erstem Zeichnen und Anmeldung nachholen
    return off;
  }, []);
  return sync;
}

/** Wer ist gerade in dieser Notiz (außer mir)? Aktualisiert sich selbst, damit Verschwundene ausgeblendet werden. */
export function usePresence(noteId: string) {
  const [, set] = useState(0);
  useEffect(() => {
    const off = sync.subscribe(() => set((v) => v + 1));
    set((v) => v + 1);
    const t = setInterval(() => set((v) => v + 1), 5000);
    return () => {
      off();
      clearInterval(t);
    };
  }, []);
  return sync.engine?.othersIn(noteId) ?? [];
}
