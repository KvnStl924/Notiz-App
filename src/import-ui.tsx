import { useState } from 'preact/hooks';
import { X } from 'lucide-preact';
import { importMarkdown } from './import';
import type { NoteType } from './model';
import { store } from './store';

/** Fenster zum Einfügen eines Rezepts (oder einer Notiz) als Text, z. B. aus einem Chat mit Claude. */
export function ImportPanel(props: { type: NoteType; onClose: () => void; onImported: (id: string) => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const what = props.type === 'recipe' ? 'Rezept' : 'Notiz';

  const run = () => {
    const note = importMarkdown(text, props.type);
    if (!note) {
      setErr('In diesem Text habe ich nichts zum Importieren gefunden.');
      return;
    }
    store.save(note);
    props.onImported(note.id);
  };

  return (
    <>
      <div class="sheet-backdrop" onClick={props.onClose} />
      <div class="panel glass strong" role="dialog" aria-label={`${what} einfügen`}>
        <button class="panel-close" onClick={props.onClose} aria-label="Schließen">
          <X size={20} />
        </button>
        <h2 class="panel-title">{what} aus Text einfügen</h2>
        <p class="panel-text">
          Füge hier den Text ein, den Claude dir für das {what} gegeben hat. Es entsteht ein neuer Eintrag, nichts Vorhandenes wird überschrieben.
        </p>
        <textarea
          class="field area tall"
          placeholder={'# Spaghetti Carbonara\n\n## Zutaten\n| Menge | Zutat |\n…'}
          value={text}
          onInput={(e) => {
            setText((e.target as HTMLTextAreaElement).value);
            setErr('');
          }}
          autocapitalize="off"
          autocorrect="off"
          spellcheck={false}
        />
        <button class="btn-primary" disabled={!text.trim()} onClick={run}>
          Importieren
        </button>
        {err && <p class="panel-error">{err}</p>}
      </div>
    </>
  );
}
