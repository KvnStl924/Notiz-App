import '@fontsource-variable/inter';
import { render } from 'preact';
import { App } from './app';
import { sync } from './sync/manager';
import './styles.css';

render(<App />, document.getElementById('app')!);
void sync.init();

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    } catch {
      /* Service Worker nicht erlaubt (z. B. eingebettete Vorschau) */
    }
  });
}
