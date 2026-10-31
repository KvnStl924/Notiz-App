import { initializeApp, type FirebaseOptions } from 'firebase/app';
import {
  collection,
  connectFirestoreEmulator,
  doc,
  initializeFirestore,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  writeBatch,
} from 'firebase/firestore';
import type { Backend, Change, Data, Listener, Op } from './backend';

export interface FirebaseConfig extends FirebaseOptions {
  /** Nur für Tests: "host:port" des lokalen Emulators */
  emulator?: string;
}

/**
 * Firestore als Server. Alle Daten liegen unter `spaces/{Bereichs-Code}/…`.
 * Mit `persistent` (im Browser) bleibt ein Offline-Speicher erhalten: Änderungen ohne Netz
 * werden gesammelt und später gesendet.
 */
export function createFirestoreBackend(cfg: FirebaseConfig, space: string, opts: { persistent: boolean; appName?: string }): Backend {
  const { emulator, ...options } = cfg;
  const app = initializeApp(options, opts.appName ?? `notiz-${space.slice(0, 8)}`);
  const db = initializeFirestore(
    app,
    opts.persistent ? { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) } : {},
  );
  if (emulator) {
    const [host, port] = emulator.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }
  const col = (name: string) => collection(db, 'spaces', space, name);

  return {
    listen(name, onChange, onError): Listener {
      let resolve!: () => void;
      const ready = new Promise<void>((r) => (resolve = r));
      const timer = setTimeout(resolve, 4000); // offline: nicht ewig auf den Server warten
      const unsub = onSnapshot(
        col(name),
        { includeMetadataChanges: true },
        (snap) => {
          const changes: Change[] = snap.docChanges({ includeMetadataChanges: false }).map((ch) => ({
            id: ch.doc.id,
            data: ch.type === 'removed' ? null : (ch.doc.data() as Data),
          }));
          if (changes.length) onChange(changes);
          if (!snap.metadata.fromCache) {
            clearTimeout(timer);
            resolve();
          }
        },
        onError,
      );
      return {
        unsubscribe: () => {
          clearTimeout(timer);
          unsub();
        },
        ready,
      };
    },

    async commit(ops: Op[]) {
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(db);
        for (const op of ops.slice(i, i + 400)) {
          const ref = doc(col(op.collection), op.id);
          if (op.type === 'set') batch.set(ref, JSON.parse(JSON.stringify(op.data))); // undefined entfernen
          else batch.delete(ref);
        }
        await batch.commit();
      }
    },
  };
}
