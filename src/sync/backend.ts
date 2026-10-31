/** Schmale Schnittstelle zum Server. Firestore ist eine Umsetzung, `MemoryBackend` (Tests) eine andere. */
export type Data = Record<string, unknown>;

export interface Change {
  id: string;
  /** null = Dokument wurde gelöscht */
  data: Data | null;
}

export type Op =
  | { type: 'set'; collection: string; id: string; data: Data }
  | { type: 'delete'; collection: string; id: string };

export interface Listener {
  unsubscribe(): void;
  /** Wird erfüllt, sobald der erste Stand vom Server da ist (oder nach einer Wartezeit, z. B. offline). */
  ready: Promise<void>;
}

export interface Backend {
  listen(collection: string, onChange: (changes: Change[]) => void, onError: (e: unknown) => void): Listener;
  /** Mehrere Schreibvorgänge gemeinsam (alles oder nichts). */
  commit(ops: Op[]): Promise<void>;
}
