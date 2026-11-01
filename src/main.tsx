import '@fontsource-variable/inter';
import { render } from 'preact';
import { App } from './app';
import { inbox } from './inbox';
import { sync } from './sync/manager';
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

render(<App />, document.getElementById('app')!);
void sync.init();
inbox.start();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch {
      /* Service Worker nicht erlaubt (z. B. eingebettete Vorschau) */
    }
  });
}
