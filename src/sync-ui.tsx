import { useState } from 'preact/hooks';
import { Check, Copy, LogOut, Users, X } from 'lucide-preact';
import { parseSpaceCode, sync, useSync, type SyncView } from './sync/manager';
import { Sheet } from './ui';

const STATUS: Record<SyncView, { text: string; color: string }> = {
  unavailable: { text: '', color: 'transparent' },
  local: { text: 'Nur auf diesem Gerät', color: 'var(--label-3)' },
  connecting: { text: 'Verbinde …', color: 'var(--orange)' },
  online: { text: 'Synchronisiert', color: 'var(--green)' },
  offline: { text: 'Offline – wird nachgeholt', color: 'var(--orange)' },
  error: { text: 'Verbindungsproblem', color: 'var(--red)' },
};

/** Farbe je Person, damit man Cursor und Namen unterscheiden kann. */
export function personColor(name: string): string {
  const palette = ['#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff'];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/** Runder Glas-Knopf oben links mit Status-Punkt. Nur sichtbar, wenn Sync eingerichtet werden kann. */
export function SyncButton() {
  useSync();
  if (!sync.available) return null;
  const v = sync.view;
  return (
    <button class="sync-btn nav-btn round glass" onClick={() => sync.openPanel(true)} aria-label="Gemeinsamer Bereich">
      <Users size={22} />
      <span class="sync-dot" style={{ background: STATUS[v].color }} />
    </button>
  );
}

export function SyncPanel() {
  useSync();
  if (!sync.available || !sync.panelOpen) return null;
  return (
    <>
      <div class="sheet-backdrop" onClick={() => sync.openPanel(false)} />
      <div class="panel glass strong" role="dialog" aria-label="Gemeinsamer Bereich">
        <button class="panel-close" onClick={() => sync.openPanel(false)} aria-label="Schließen">
          <X size={20} />
        </button>
        {sync.saved ? <Connected /> : <Setup />}
      </div>
    </>
  );
}

function Setup() {
  const invited = sync.pendingJoin;
  const [name, setName] = useState('');
  const [link, setLink] = useState(invited ? `…#join-${invited}` : '');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const code = invited ?? parseSpaceCode(link);
  const nameOk = name.trim().length > 0;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setErr('');
    try {
      await fn();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h2 class="panel-title">{invited ? 'Du wurdest eingeladen' : 'Gemeinsam nutzen'}</h2>
      <p class="panel-text">
        {invited
          ? 'Tritt dem gemeinsamen Bereich bei. Ab dann siehst du Änderungen sofort und die anderen deine.'
          : 'Rezepte, Notizen und Einkaufsliste mit Isabelle teilen. Änderungen erscheinen sofort auf beiden Handys.'}
      </p>

      <label class="field-label">Dein Name</label>
      <input class="field" placeholder="z. B. Kevin" value={name} onInput={(e) => setName((e.target as HTMLInputElement).value)} />

      {!invited && (
        <>
          <button class="btn-primary" disabled={!nameOk || busy} onClick={() => run(() => sync.create(name))}>
            Neuen gemeinsamen Bereich anlegen
          </button>
          <div class="panel-or">oder beitreten</div>
          <input
            class="field"
            placeholder="Einladungslink einfügen"
            value={link}
            onInput={(e) => setLink((e.target as HTMLInputElement).value)}
            autocapitalize="off"
            autocorrect="off"
          />
        </>
      )}
      {(invited || link) && (
        <button class={invited ? 'btn-primary' : 'btn-secondary'} disabled={!nameOk || !code || busy} onClick={() => run(() => sync.join(invited ?? link, name))}>
          Beitreten
        </button>
      )}
      {err && <p class="panel-error">{err}</p>}
      <p class="panel-note">Deine vorhandenen Notizen auf diesem Gerät werden in den gemeinsamen Bereich übernommen.</p>
      <button class="btn-link" onClick={() => (invited ? sync.openPanel(false) : sync.dismissOnboarding())}>
        {invited ? 'Später' : 'Nur auf diesem Gerät nutzen'}
      </button>
    </>
  );
}

function Connected() {
  const [name, setName] = useState(sync.saved!.name);
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const v = sync.view;
  const link = sync.inviteLink();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Zwischenablage nicht erlaubt: Link lässt sich im Feld markieren */
    }
  };
  const online = [...(sync.engine?.presence.values() ?? [])].filter(
    (p) => p.clientId !== sync.saved!.clientId && Date.now() - p.ts < 30_000,
  );

  return (
    <>
      <h2 class="panel-title">Gemeinsamer Bereich</h2>
      <div class="status-row">
        <span class="sync-dot static" style={{ background: STATUS[v].color }} />
        <span>{STATUS[v].text}</span>
      </div>
      {v === 'error' && sync.engine?.error && <p class="panel-error">{sync.engine.error}</p>}
      {online.length > 0 && <p class="panel-text">Gerade aktiv: {online.map((p) => p.name).join(', ')}</p>}

      <label class="field-label">Dein Name</label>
      <input
        class="field"
        value={name}
        onInput={(e) => setName((e.target as HTMLInputElement).value)}
        onBlur={() => sync.rename(name)}
        enterkeyhint="done"
      />

      <label class="field-label">Einladungslink für Isabelle</label>
      <input class="field" readOnly value={link} onFocus={(e) => (e.target as HTMLInputElement).select()} />
      <button class="btn-secondary" onClick={copy}>
        {copied ? <Check size={18} /> : <Copy size={18} />} {copied ? 'Kopiert' : 'Link kopieren'}
      </button>
      <p class="panel-note">Wer diesen Link hat, kann alles in diesem Bereich lesen und ändern. Gib ihn nur an Personen, denen du vertraust.</p>

      <button class="btn-link danger" onClick={() => setConfirmLeave(true)}>
        <LogOut size={16} /> Bereich verlassen
      </button>
      {confirmLeave && (
        <Sheet
          title="Dieses Gerät trennt sich. Die Notizen bleiben hier gespeichert und im gemeinsamen Bereich erhalten."
          actions={[{ label: 'Verlassen', destructive: true, onSelect: () => sync.leave() }]}
          onClose={() => setConfirmLeave(false)}
        />
      )}
    </>
  );
}
