import { useState } from 'preact/hooks';
import { X } from 'lucide-preact';
import { inbox, useInbox } from './inbox';

/** Einrichtung und Status des Rezept-Eingangs (Google-Tabelle, in die Claude Rezepte einträgt). */
export function InboxPanel(props: { onClose: () => void }) {
  useInbox();
  const [link, setLink] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const connected = !!inbox.saved;

  const connect = async () => {
    setBusy(true);
    setErr('');
    const e = await inbox.connect(link);
    setBusy(false);
    if (e) setErr(e);
  };
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
              Claude trägt Rezepte in eine Google-Tabelle ein, die App holt sie dort ab und legt sie als neue Rezepte an, alle paar Minuten und beim Öffnen.
            </p>
            <ol class="steps-help">
              <li>
                Öffne die Tabelle <b>„Notiz-App Rezept-Eingang“</b> in Google Drive.
              </li>
              <li>
                <b>Teilen → Allgemeiner Zugriff → „Jeder mit dem Link“</b>, Rolle <b>Betrachter</b>.
              </li>
              <li>Link kopieren und hier einfügen.</li>
            </ol>
            <input
              class="field"
              placeholder="Link zur Google-Tabelle"
              value={link}
              onInput={(e) => {
                setLink((e.target as HTMLInputElement).value);
                setErr('');
              }}
              autocapitalize="off"
              autocorrect="off"
            />
            <button class="btn-primary" disabled={!link.trim() || busy} onClick={connect}>
              {busy ? 'Prüfe …' : 'Verbinden'}
            </button>
            {err && <p class="panel-error">{err}</p>}
            <p class="panel-note">Nur Betrachter: Die App kann in der Tabelle nichts ändern. Wer den Tabellen-Link kennt, kann die Rezepte darin lesen.</p>
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
            <button class="btn-link danger" onClick={() => inbox.disconnect()}>
              Verbindung trennen
            </button>
            <p class="panel-note">Gelöschte Rezepte kommen nicht zurück, auch wenn die Zeile in der Tabelle bleibt.</p>
          </>
        )}
      </div>
    </>
  );
}
