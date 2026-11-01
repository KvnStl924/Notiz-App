import { useState } from 'preact/hooks';
import { Trash2, Undo2, X } from 'lucide-preact';
import { daysLeft, trash, useTrash, type TrashEntry } from './trash';
import { store } from './store';
import { sync } from './sync/manager';
import { Sheet } from './ui';

/** Wiederherstellen: Notiz zurück in die Liste, Blöcke erneut an den gemeinsamen Bereich senden. */
export function restoreFromTrash(id: string) {
  const note = trash.take(id);
  if (!note) return;
  sync.engine?.forgetBlocks(note.blocks.map((b) => b.id));
  store.save(note);
}

const tage = (n: number) => (n === 1 ? '1 Tag' : `${n} Tage`);

export function TrashPanel(props: { onClose: () => void }) {
  const items = useTrash();
  const [askForever, setAskForever] = useState<TrashEntry | null>(null);
  const [askEmpty, setAskEmpty] = useState(false);

  return (
    <>
      <div class="sheet-backdrop" onClick={props.onClose} />
      <div class="panel glass strong" role="dialog" aria-label="Papierkorb">
        <button class="panel-close" onClick={props.onClose} aria-label="Schließen">
          <X size={20} />
        </button>
        <h2 class="panel-title">Papierkorb</h2>
        <p class="panel-text">
          Gelöschte Rezepte und Notizen bleiben {tage(30)} hier. Danach werden sie automatisch endgültig gelöscht.
        </p>

        {items.length === 0 ? (
          <p class="panel-note" style={{ textAlign: 'center', margin: '24px 0' }}>
            Der Papierkorb ist leer.
          </p>
        ) : (
          <>
            <div class="group glass trash-list">
              {items.map((e) => (
                <div class="trash-row" key={e.note.id}>
                  <div class="trash-text">
                    <div class="row-title">{e.note.title || 'Ohne Titel'}</div>
                    <div class="row-sub">
                      {e.note.type === 'recipe' ? 'Rezept' : 'Notiz'} · noch {tage(daysLeft(e))}
                    </div>
                  </div>
                  <button class="trash-restore" onClick={() => restoreFromTrash(e.note.id)} aria-label="Wiederherstellen">
                    <Undo2 size={18} /> Wiederherstellen
                  </button>
                  <button class="trash-del" onClick={() => setAskForever(e)} aria-label="Endgültig löschen">
                    <Trash2 size={18} />
                  </button>
                </div>
              ))}
            </div>
            <button class="btn-link danger" onClick={() => setAskEmpty(true)}>
              Papierkorb leeren
            </button>
          </>
        )}
      </div>

      {askForever && (
        <Sheet
          title={`„${askForever.note.title || 'Ohne Titel'}“ wird endgültig gelöscht. Das kann nicht rückgängig gemacht werden.`}
          actions={[{ label: 'Endgültig löschen', destructive: true, onSelect: () => trash.forever(askForever.note.id) }]}
          onClose={() => setAskForever(null)}
        />
      )}
      {askEmpty && (
        <Sheet
          title="Alles im Papierkorb wird endgültig gelöscht. Das kann nicht rückgängig gemacht werden."
          actions={[{ label: 'Papierkorb leeren', destructive: true, onSelect: () => trash.empty() }]}
          onClose={() => setAskEmpty(false)}
        />
      )}
    </>
  );
}
