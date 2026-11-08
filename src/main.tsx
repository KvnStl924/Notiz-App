import '@fontsource-variable/inter';
import { render } from 'preact';
import { App } from './app';
import { inbox } from './inbox';
import { sync } from './sync/manager';
import { keepScreenOn } from './wake-lock';
import './styles.css';

/**
 * Farbe der Statusleiste (Android malt sie in einer Farbe): sie wird genau auf den Hintergrund oben gesetzt,
 * damit kein Übergang sichtbar ist. Folgt dem Hell/Dunkel-Modus des Geräts.
 */
function syncThemeColor() {
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  if (!bg) return;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = bg;
  document.head.appendChild(meta);
}
syncThemeColor();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', syncThemeColor);

/**
 * Kein Zoomen mit zwei Fingern (iPhone ignoriert die Viewport-Angabe dazu, daher per Ereignis).
 * Die App soll sich wie eine native App verhalten.
 */
for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
}
document.addEventListener(
  'touchmove',
  (e) => {
    if (e.touches.length > 1) e.preventDefault();
  },
  { passive: false },
);

// iPhone: die Statusleiste ist durchsichtig, der Hintergrund läuft also bis ganz nach oben.
// Android malt die Leiste in einer Farbe, dort bleibt der Schimmer unterhalb der Leiste.
if (/iPhone|iPad|iPod/.test(navigator.userAgent)) document.documentElement.classList.add('ios');

/**
 * iPhone (Safari/PWA): nach dem Zurückkehren aus dem Hintergrund bleiben Glas-Flächen (backdrop-filter)
 * manchmal als alte Bilder stehen. Ein erzwungenes Neuzeichnen der Oberfläche behebt das.
 */
function repaintOnReturn() {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const app = document.getElementById('app')!;
    app.style.transform = 'translateZ(0)';
    void app.offsetHeight; // Layout erzwingen
    requestAnimationFrame(() => {
      app.style.transform = '';
    });
  });
}

/**
 * Hochformat festhalten. Das Manifest sagt es schon, Android übernimmt Änderungen daran aber erst
 * nach Tagen oder einer Neuinstallation. Die Sperre per Code wirkt sofort in der installierten App.
 */
function lockPortrait() {
  const lock = () => {
    try {
      const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
      o.lock?.('portrait').catch(() => {});
    } catch {
      /* nicht unterstützt (z. B. iPhone oder normaler Browser-Tab) */
    }
  };
  lock();
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && lock());
}

render(<App />, document.getElementById('app')!);
lockPortrait();
void sync.init();
inbox.start();
keepScreenOn();
repaintOnReturn();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch {
      /* Service Worker nicht erlaubt (z. B. eingebettete Vorschau) */
    }
  });
}
