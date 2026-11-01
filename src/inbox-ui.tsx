import { X } from 'lucide-preact';
import { inbox, useInbox } from './inbox';

/** Einrichtung und Status des Rezept-Eingangs aus einer Google-Tabelle. */
export function InboxPanel(props: { onClose: () => void }) {
  useInbox();
  const connected = !!inbox.saved;
  const last = inbox.saved?.lastCheck ? new Date(inbox.saved.lastCheck).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <>
      <div class="sheet-backdrop" onClick={props.onClose} />
      <div class="panel glass strong" role="dialog" aria-label="Rezept-Eingang">
        <button class="panel-close" onClick={props.onClose} aria-label="Schließen">
          <X size={20} />
        </button>
        <h2 class="panel-title">Rezept-Eingang</h2>

        {!connected ? (
          <>
            <p class="panel-text">
              Der Rezept-Eingang wird automatisch eingerichtet. Neue Zeilen werden übernommen, solange die App geöffnet ist; im Hintergrund pausiert der Abruf.
            </p>
            <button class="btn-primary" disabled={inbox.status === 'checking'} onClick={() => void inbox.check(true)}>
              {inbox.status === 'checking' ? 'Prüfe …' : 'Jetzt prüfen'}
            </button>
          </>
        ) : (
          <>
            <div class="status-row">
              <span class="sync-dot static" style={{ background: inbox.status === 'error' ? 'var(--red)' : 'var(--green)' }} />
              <span>{inbox.status === 'checking' ? 'Prüfe …' : inbox.status === 'error' ? 'Verbindungsproblem' : 'Verbunden'}</span>
            </div>
            {inbox.status === 'error' && <p class="panel-error">{inbox.error}</p>}
            <p class="panel-text">
              {inbox.saved!.imported.length} Rezept{inbox.saved!.imported.length === 1 ? '' : 'e'} übernommen{last ? ` · zuletzt geprüft um ${last} Uhr` : ''}.
            </p>
            <button class="btn-secondary" disabled={inbox.status === 'checking'} onClick={() => void inbox.check(true)}>
              Jetzt prüfen
            </button>
            <p class="panel-note">Gelöschte Rezepte kommen nicht zurück, auch wenn die Zeile in der Tabelle bleibt.</p>
          </>
        )}
      </div>
    </>
  );
}
