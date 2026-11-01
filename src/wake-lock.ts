/**
 * Hält das Display an, solange die App sichtbar ist (Screen Wake Lock). Sobald die App nicht mehr
 * angezeigt wird, lässt die Sperre das Display wieder normal ausgehen.
 * Geräte ohne Unterstützung oder mit Akku-Sparmodus: stillschweigend nichts tun.
 */

interface Sentinel {
  release(): Promise<void>;
  addEventListener(type: 'release', fn: () => void): void;
}
type WakeLockApi = { request(type: 'screen'): Promise<Sentinel> };

let lock: Sentinel | null = null;

async function holdScreen() {
  const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
  if (!api || lock || document.visibilityState !== 'visible') return;
  try {
    const s = await api.request('screen');
    lock = s;
    s.addEventListener('release', () => {
      if (lock === s) lock = null;
    });
  } catch {
    /* nicht erlaubt: dann geht das Display eben wie sonst aus */
  }
}

function releaseScreen() {
  const s = lock;
  lock = null;
  void s?.release().catch(() => {});
}

export function keepScreenOn() {
  void holdScreen();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void holdScreen();
    else releaseScreen();
  });
  // Manche Geräte erlauben die Sperre erst nach einer Berührung: beim ersten Antippen noch einmal versuchen
  document.addEventListener('pointerdown', () => void holdScreen(), { passive: true });
}
