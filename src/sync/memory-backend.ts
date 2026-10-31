import type { Backend, Change, Data, Listener, Op } from './backend';

/** Gemeinsamer „Server“ im Arbeitsspeicher für Tests: mehrere Geräte hängen am selben `MemoryServer`. */
export class MemoryServer {
  docs = new Map<string, Data>(); // "collection/id" -> Daten
  subs = new Set<{ collection: string; cb: (c: Change[]) => void; online: () => boolean }>();

  backend(): MemoryBackend {
    return new MemoryBackend(this);
  }
}

export class MemoryBackend implements Backend {
  offline = false;
  private pending: Op[][] = [];
  constructor(private server: MemoryServer) {}

  listen(collection: string, onChange: (c: Change[]) => void): Listener {
    const sub = { collection, cb: onChange, online: () => !this.offline };
    this.server.subs.add(sub);
    const initial: Change[] = [];
    for (const [k, data] of this.server.docs) {
      const [c, ...rest] = k.split('/');
      if (c === collection) initial.push({ id: rest.join('/'), data: structuredClone(data) });
    }
    const ready = new Promise<void>((res) =>
      setTimeout(() => {
        if (initial.length) onChange(initial);
        res();
      }, 0),
    );
    return { unsubscribe: () => this.server.subs.delete(sub), ready };
  }

  async commit(ops: Op[]): Promise<void> {
    if (this.offline) {
      this.pending.push(ops); // wie der Offline-Cache von Firestore: später nachholen
      return;
    }
    this.apply(ops);
  }

  /** Verbindung wieder da: aufgestaute Schreibvorgänge senden. */
  goOnline() {
    this.offline = false;
    for (const ops of this.pending.splice(0)) this.apply(ops);
  }

  private apply(ops: Op[]) {
    const byCollection = new Map<string, Change[]>();
    for (const op of ops) {
      const key = `${op.collection}/${op.id}`;
      let data: Data | null = null;
      if (op.type === 'set') {
        data = structuredClone(op.data);
        this.server.docs.set(key, data);
      } else this.server.docs.delete(key);
      const list = byCollection.get(op.collection) ?? [];
      list.push({ id: op.id, data: data && structuredClone(data) });
      byCollection.set(op.collection, list);
    }
    // Zustellung asynchron, wie bei einem echten Server
    setTimeout(() => {
      for (const sub of this.server.subs) {
        const ch = byCollection.get(sub.collection);
        if (ch && sub.online()) sub.cb(structuredClone(ch));
      }
    }, 0);
  }
}
