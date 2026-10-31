import '@fontsource-variable/inter';
import { render } from 'preact';
import { App } from './app';
import './styles.css';

render(<App />, document.getElementById('app')!);

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    try {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    } catch {
      /* Service Worker nicht erlaubt (z. B. eingebettete Vorschau) */
    }
  });
}
