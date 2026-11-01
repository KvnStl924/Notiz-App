import type { Block, Note, ShopItem } from '../model';
import type { NoteStore, ShopStore } from '../store';
import type { Backend, Change, Data, Listener, Op } from './backend';

/**
 * Live-Abgleich zwischen Geräten.
 *
 * - Notizen werden in Blöcke zerlegt: Dokument `notes/{id}` (Titel, Reihenfolge) und je Block ein
 *   Dokument `blocks/{id}`. Wer verschiedene Blöcke bearbeitet, überschreibt sich nie.
 * - Im selben Block gewinnt die jüngere Änderung (`rev`). Solange man selbst gerade in einem Block
 *   tippt, werden fremde Änderungen daran zurückgehalten, damit der Cursor nicht springt.
 * - Zusammen mit „wer ist gerade wo“ (Presence) sieht man, was der andere tut.
 */

const FLUSH_MS = 350; // Tippen bündeln
const ACTIVE_MS = 2500; // so lange gilt ein Block nach eigener Änderung als „in Arbeit“
const PRESENCE_TTL = 30_000;
const HEARTBEAT_MS = 12_000;

export interface Identity {
  clientId: string;
  name: string;
}

export interface Presence {
  clientId: string;
  name: string;
  noteId: string | null;
  blockId: string | null;
  ts: number;
}

export type SyncStatus = 'connecting' | 'online' | 'offline' | 'error';

interface MetaDoc extends Data {
  title: string;
  type: 'note' | 'recipe';
  servings: number | null;
  order: string[];
  updatedAt: number;
  deleted?: boolean;
  by: string;
}
interface BlockDoc extends Data {
  noteId: string;
  data: string;
  rev: number;
  by: string;
}

const isMeta = (d: Data | null): d is MetaDoc =>
  !!d && typeof d.title === 'string' && Array.isArray(d.order) && typeof d.updatedAt === 'number' && (d.type === 'note' || d.type === 'recipe');
const isBlock = (d: Data | null): d is BlockDoc =>
  !!d && typeof d.noteId === 'string' && typeof d.data === 'string' && typeof d.rev === 'number';
const isShop = (d: Data | null) =>
  !!d && typeof d.rev === 'number' && (d.deleted === true || (typeof d.name === 'string' && typeof d.addedAt === 'string'));

export class SyncEngine {
  status: SyncStatus = 'connecting';
  error = '';
  presence = new Map<string, Presence>();

  private listeners = new Set<() => void>();
  private subs: Listener[] = [];
  private stopped = false;

  // Stand auf dem Server (so wie wir ihn zuletzt gesehen haben)
  private metas = new Map<string, MetaDoc>();
  private blocks = new Map<string, BlockDoc>();
  private shopDocs = new Map<string, Data>();

  // Was dieses Gerät zuletzt gesendet bzw. übernommen hat
  private knownRev = new Map<string, number>();
  private sentJson = new Map<string, string>();
  private knownOrder = new Map<string, string[]>();
  private knownMetaTs = new Map<string, number>();
  private synced = new Set<string>();
  private activeUntil = new Map<string, number>();
  private shopActive = new Map<string, number>();
  private lastRev = 0;

  private flushTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private shopTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private deferTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private focus: { noteId: string | null; blockId: string | null } = { noteId: null, blockId: null };
  private heartbeat?: ReturnType<typeof setInterval>;
  private presenceTimer?: ReturnType<typeof setTimeout>;

  private noteHook = {
    saved: (n: Note) => this.onNoteSaved(n),
    removed: (id: string) => this.onNoteRemoved(id),
  };
  private shopHook = {
    saved: (i: ShopItem) => this.onShopSaved(i),
    removed: (id: string) => this.onShopRemoved(id),
  };

  constructor(
    private notes: NoteStore,
    private shop: ShopStore,
    private backend: Backend,
    public me: Identity,
  ) {}

  /* ───────── Start / Stopp ───────── */

  async start() {
    const err = (e: unknown) => this.fail(e);
    const l = [
      this.backend.listen('notes', (c) => this.onNotes(c), err),
      this.backend.listen('blocks', (c) => this.onBlocks(c), err),
      this.backend.listen('shop', (c) => this.onShop(c), err),
      this.backend.listen('presence', (c) => this.onPresence(c), err),
    ];
    this.subs = l;
    await Promise.all(l.map((x) => x.ready));
    if (this.stopped) return;

    // Hooks erst nach dem ersten Stand, damit Übernahmen nicht als eigene Änderung gelten
    this.notes.hooks.push(this.noteHook);
    this.shop.hooks.push(this.shopHook);

    // Vorhandene lokale Daten hochladen, wenn sie neuer sind oder dem Server fehlen
    for (const n of this.notes.all()) {
      const m = this.metas.get(n.id);
      if (!m || Date.parse(n.updatedAt) > m.updatedAt) this.flushNote(n.id);
    }
    for (const i of this.shop.all()) {
      const d = this.shopDocs.get(i.id);
      if (!d || (i.rev ?? 0) > ((d.rev as number) ?? 0)) this.sendShop(i.id);
    }
    if (this.status === 'connecting') this.setStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online');
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.onOnline);
      window.addEventListener('offline', this.onOffline);
    }
  }

  stop() {
    this.stopped = true;
    this.subs.forEach((s) => s.unsubscribe());
    this.notes.hooks = this.notes.hooks.filter((h) => h !== this.noteHook);
    this.shop.hooks = this.shop.hooks.filter((h) => h !== this.shopHook);
    for (const t of [...this.flushTimers.values(), ...this.shopTimers.values(), ...this.deferTimers.values()]) clearTimeout(t);
    clearInterval(this.heartbeat);
    clearTimeout(this.presenceTimer);
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('offline', this.onOffline);
    }
  }

  /** Schreibvorgänge zeitnah abschließen (z. B. beim Verlassen der Seite). */
  flushAll() {
    for (const [id, t] of this.flushTimers) {
      clearTimeout(t);
      this.flushNote(id);
    }
    for (const [id, t] of this.shopTimers) {
      clearTimeout(t);
      this.sendShop(id);
    }
  }

  private onOnline = () => this.setStatus('online');
  private onOffline = () => this.setStatus('offline');

  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  private notify() {
    this.listeners.forEach((l) => l());
  }
  private setStatus(s: SyncStatus) {
    if (this.status === s) return;
    this.status = s;
    this.notify();
  }
  private fail(e: unknown) {
    this.error = e instanceof Error ? e.message : String(e);
    this.setStatus('error');
  }

  private nextRev() {
    this.lastRev = Math.max(Date.now(), this.lastRev + 1);
    return this.lastRev;
  }

  private send(ops: Op[]) {
    if (!ops.length) return;
    this.backend.commit(ops).catch((e) => this.fail(e));
  }

  /* ───────── Notizen: lokal → Server ───────── */

  private onNoteSaved(note: Note) {
    const now = Date.now();
    for (const b of note.blocks) {
      if (JSON.stringify(b) !== this.sentJson.get(b.id)) this.activeUntil.set(b.id, now + ACTIVE_MS);
    }
    clearTimeout(this.flushTimers.get(note.id));
    this.flushTimers.set(
      note.id,
      setTimeout(() => this.flushNote(note.id), FLUSH_MS),
    );
  }

  private onNoteRemoved(id: string) {
    clearTimeout(this.flushTimers.get(id));
    this.flushTimers.delete(id);
    const ops: Op[] = [];
    for (const [bid, bd] of this.blocks) if (bd.noteId === id) ops.push({ type: 'delete', collection: 'blocks', id: bid });
    const ts = Date.now();
    ops.push({
      type: 'set',
      collection: 'notes',
      id,
      data: { title: '', type: 'note', servings: null, order: [], updatedAt: ts, deleted: true, by: this.me.clientId },
    });
    this.send(ops);
  }

  private flushNote(id: string) {
    this.flushTimers.delete(id);
    const note = this.notes.get(id);
    if (!note) return;
    const ops: Op[] = [];
    const ids = new Set(note.blocks.map((b) => b.id));

    for (const b of note.blocks) {
      const json = JSON.stringify(b);
      if (this.sentJson.get(b.id) === json) continue;
      const rev = this.nextRev();
      ops.push({ type: 'set', collection: 'blocks', id: b.id, data: { noteId: id, data: json, rev, by: this.me.clientId } });
      this.sentJson.set(b.id, json);
      this.knownRev.set(b.id, rev);
      this.blocks.set(b.id, { noteId: id, data: json, rev, by: this.me.clientId });
    }
    // Entfernte Blöcke aufräumen
    for (const old of this.knownOrder.get(id) ?? []) {
      if (!ids.has(old)) {
        ops.push({ type: 'delete', collection: 'blocks', id: old });
        this.sentJson.delete(old);
        this.knownRev.delete(old);
        this.blocks.delete(old);
      }
    }
    const order = note.blocks.map((b) => b.id);
    const ts = Date.parse(note.updatedAt);
    const meta: MetaDoc = { title: note.title, type: note.type, servings: note.servings, order, updatedAt: ts, by: this.me.clientId };
    ops.push({ type: 'set', collection: 'notes', id, data: meta });
    this.metas.set(id, meta);
    this.knownOrder.set(id, order);
    this.knownMetaTs.set(id, ts);
    this.synced.add(id);
    this.send(ops);
  }

  /* ───────── Notizen: Server → lokal ───────── */

  private onNotes(changes: Change[]) {
    const touched = new Set<string>();
    for (const c of changes) {
      if (c.data && !isMeta(c.data) && c.data.deleted !== true) continue; // unbrauchbares Dokument ignorieren
      if (c.data) this.metas.set(c.id, c.data as MetaDoc);
      else this.metas.delete(c.id);
      touched.add(c.id);
    }
    touched.forEach((id) => this.safeRebuild(id));
  }

  private onBlocks(changes: Change[]) {
    const touched = new Set<string>();
    for (const c of changes) {
      const prev = this.blocks.get(c.id);
      if (c.data && !isBlock(c.data)) continue;
      if (c.data) {
        this.blocks.set(c.id, c.data as BlockDoc);
        touched.add((c.data as BlockDoc).noteId);
      } else {
        this.blocks.delete(c.id);
        if (prev) touched.add(prev.noteId);
      }
    }
    touched.forEach((id) => this.safeRebuild(id));
  }

  private safeRebuild(id: string) {
    try {
      this.rebuild(id);
    } catch (e) {
      this.fail(e);
    }
  }

  /**
   * Baut eine Notiz aus lokalem und entferntem Stand zusammen.
   * Welche Blöcke es gibt, ergibt sich aus den Block-Dokumenten (nicht aus der Reihenfolge-Liste),
   * damit gleichzeitig angelegte Blöcke nie verloren gehen. Die Liste bestimmt nur die Reihenfolge.
   */
  private rebuild(noteId: string) {
    const meta = this.metas.get(noteId);
    if (!meta) return;
    const local = this.notes.get(noteId);

    if (meta.deleted) {
      if (local) this.notes.removeRemote(noteId);
      return;
    }

    const localTs = local ? Date.parse(local.updatedAt) : 0;
    // Hat dieses Gerät ungesendete Änderungen (z. B. umsortiert), die jünger sind als der Server-Stand?
    const dirty = !!local && localTs > (this.knownMetaTs.get(noteId) ?? 0);
    const keepLocal = !!local && dirty && localTs >= meta.updatedAt;
    const takeMeta = !keepLocal;
    const known = new Set(this.knownOrder.get(noteId) ?? []);
    const localIds = new Set(local?.blocks.map((b) => b.id) ?? []);

    const remote = new Map<string, BlockDoc>();
    for (const [id, bd] of this.blocks) if (bd.noteId === noteId) remote.set(id, bd);

    // Gehört der Block dazu?
    const include = (id: string) => {
      if (remote.has(id)) return !(known.has(id) && !localIds.has(id)); // außer: lokal gelöscht, noch nicht gesendet
      return localIds.has(id) && !this.sentJson.has(id); // lokal neu, noch nicht gesendet
    };

    const base = takeMeta ? meta.order : (local?.blocks.map((b) => b.id) ?? []);
    const ordered = base.filter(include);
    const have = new Set(ordered);
    const fresh = [...remote.entries()]
      .filter(([id]) => !have.has(id) && include(id))
      .sort((x, y) => x[1].rev - y[1].rev || (x[0] < y[0] ? -1 : 1))
      .map(([id]) => id);
    for (const id of fresh) have.add(id);
    const unsent = (local?.blocks ?? []).map((b) => b.id).filter((id) => !have.has(id) && include(id));
    const order = [...ordered, ...fresh, ...unsent];

    const now = Date.now();
    const preferLocal = !!local && !this.synced.has(noteId) && localTs > meta.updatedAt;
    const out: Block[] = [];
    const takenRemote: [string, BlockDoc][] = [];
    let deferred = false;

    for (const id of order) {
      const rd = remote.get(id);
      const lb = local?.blocks.find((b) => b.id === id);
      const newer = !!rd && rd.rev > (this.knownRev.get(id) ?? 0);
      if (lb && (!newer || preferLocal)) {
        out.push(lb);
      } else if (lb && newer && (this.activeUntil.get(id) ?? 0) > now) {
        out.push(lb); // gerade in Arbeit: fremde Änderung später prüfen
        deferred = true;
      } else if (rd) {
        out.push(JSON.parse(rd.data) as Block);
        takenRemote.push([id, rd]);
      }
    }

    const next: Note = {
      id: noteId,
      title: takeMeta ? meta.title : local!.title,
      type: takeMeta ? meta.type : local!.type,
      servings: takeMeta ? meta.servings : local!.servings,
      blocks: out,
      updatedAt: takeMeta ? new Date(meta.updatedAt).toISOString() : local!.updatedAt,
    };

    for (const [id, rd] of takenRemote) {
      this.knownRev.set(id, rd.rev);
      this.sentJson.set(id, rd.data);
    }
    // Was es laut Server gibt, merken (lokal gelöschte, noch nicht gesendete bleiben vermerkt, damit sie gelöscht werden)
    const nowIds = new Set(out.map((b) => b.id));
    const nextKnown = new Set(nowIds);
    for (const id of known) if (!nowIds.has(id) && remote.has(id)) nextKnown.add(id);
    this.knownOrder.set(noteId, [...nextKnown]);
    if (takeMeta) this.knownMetaTs.set(noteId, meta.updatedAt);
    this.synced.add(noteId);

    if (!local || JSON.stringify(local) !== JSON.stringify(next)) this.notes.applyRemote(next);

    if (deferred) {
      clearTimeout(this.deferTimers.get(noteId));
      this.deferTimers.set(
        noteId,
        setTimeout(() => this.safeRebuild(noteId), ACTIVE_MS + 50),
      );
    }
  }

  /* ───────── Einkaufsliste ───────── */

  private onShopSaved(item: ShopItem) {
    this.shopActive.set(item.id, Date.now() + ACTIVE_MS);
    item.rev = this.nextRev();
    clearTimeout(this.shopTimers.get(item.id));
    this.shopTimers.set(
      item.id,
      setTimeout(() => this.sendShop(item.id), FLUSH_MS),
    );
  }

  private onShopRemoved(id: string) {
    clearTimeout(this.shopTimers.get(id));
    this.shopTimers.delete(id);
    const rev = this.nextRev();
    this.shopDocs.set(id, { deleted: true, rev });
    this.send([{ type: 'set', collection: 'shop', id, data: { deleted: true, rev, by: this.me.clientId } }]);
  }

  private sendShop(id: string) {
    this.shopTimers.delete(id);
    const i = this.shop.get(id);
    if (!i) return;
    const data: Data = {
      name: i.name,
      amount: i.amount,
      recipeId: i.recipeId,
      recipeTitle: i.recipeTitle,
      home: i.home,
      bought: i.bought,
      addedAt: i.addedAt,
      rev: i.rev ?? this.nextRev(),
      deleted: false,
      by: this.me.clientId,
    };
    this.shopDocs.set(id, data);
    this.send([{ type: 'set', collection: 'shop', id, data }]);
  }

  private onShop(changes: Change[]) {
    for (const c of changes) {
      if (!c.data || !isShop(c.data)) continue;
      this.shopDocs.set(c.id, c.data);
      const d = c.data;
      const local = this.shop.get(c.id);
      const rev = (d.rev as number) ?? 0;
      if (local && (local.rev ?? 0) >= rev) continue; // eigener Stand ist gleich oder neuer
      const activeUntil = this.shopActive.get(c.id) ?? 0;
      if (local && activeUntil > Date.now()) {
        // gerade in Arbeit: danach noch einmal prüfen, sonst ginge die fremde Änderung verloren
        const key = 'shop:' + c.id;
        clearTimeout(this.deferTimers.get(key));
        this.deferTimers.set(
          key,
          setTimeout(() => {
            this.deferTimers.delete(key);
            const latest = this.shopDocs.get(c.id);
            if (latest && !this.stopped) this.onShop([{ id: c.id, data: latest }]);
          }, activeUntil - Date.now() + 50),
        );
        continue;
      }
      if (d.deleted) {
        if (local) this.shop.removeRemote(c.id);
      } else {
        this.shop.applyRemote({
          id: c.id,
          name: d.name as string,
          amount: d.amount as string,
          recipeId: (d.recipeId as string | null) ?? null,
          recipeTitle: (d.recipeTitle as string) ?? '',
          home: !!d.home,
          bought: !!d.bought,
          addedAt: d.addedAt as string,
          rev,
        });
      }
    }
  }

  /* ───────── Wer ist gerade wo ───────── */

  /** Wird vom Editor aufgerufen: welche Notiz und welcher Block gerade bearbeitet wird. */
  setFocus(noteId: string | null, blockId: string | null) {
    if (this.focus.noteId === noteId && this.focus.blockId === blockId) return;
    this.focus = { noteId, blockId };
    this.pushPresence();
    if (noteId && !this.heartbeat) this.heartbeat = setInterval(() => this.pushPresence(true), HEARTBEAT_MS);
    if (!noteId && this.heartbeat) {
      clearInterval(this.heartbeat);
      this.heartbeat = undefined;
    }
  }

  private pushPresence(now = false) {
    clearTimeout(this.presenceTimer);
    const run = () => {
      const p: Presence = { clientId: this.me.clientId, name: this.me.name, ...this.focus, ts: Date.now() };
      this.send([{ type: 'set', collection: 'presence', id: this.me.clientId, data: { ...p, by: this.me.clientId } }]);
    };
    if (now) run();
    else this.presenceTimer = setTimeout(run, 150);
  }

  private onPresence(changes: Change[]) {
    for (const c of changes) {
      if (c.data) this.presence.set(c.id, c.data as unknown as Presence);
      else this.presence.delete(c.id);
    }
    this.notify();
  }

  /**
   * Vergisst, welche Blöcke schon gesendet wurden (nach dem Wiederherstellen aus dem Papierkorb),
   * damit sie beim nächsten Speichern wieder an den Server gehen.
   */
  forgetBlocks(blockIds: string[]) {
    for (const id of blockIds) {
      this.sentJson.delete(id);
      this.knownRev.delete(id);
      this.blocks.delete(id);
    }
  }

  /** Kennt der gemeinsame Bereich diese Notiz schon (auch wenn sie inzwischen gelöscht wurde)? */
  knows(noteId: string): boolean {
    return this.metas.has(noteId);
  }

  /** Andere Personen, die gerade in dieser Notiz sind (frisch gemeldet). */
  othersIn(noteId: string): Presence[] {
    const now = Date.now();
    return [...this.presence.values()].filter(
      (p) => p.clientId !== this.me.clientId && p.noteId === noteId && now - p.ts < PRESENCE_TTL,
    );
  }
}
