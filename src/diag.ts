/**
 * VORÜBERGEHEND: zeigt die Bildschirmmaße, damit man das Verhalten auf dem iPhone sieht.
 * Wird wieder entfernt, sobald das Problem geklärt ist.
 */
export function startDiagnostics() {
  const box = document.createElement('div');
  box.id = 'diag';
  box.style.cssText =
    'position:fixed;left:4px;top:4px;z-index:9999;font:11px/1.35 monospace;background:rgba(0,0,0,.75);color:#0f0;padding:4px 6px;border-radius:6px;pointer-events:none;white-space:pre';
  document.body.appendChild(box);
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;bottom:0;height:0;padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden';
  document.body.appendChild(probe);
  const update = () => {
    const app = document.getElementById('app')?.getBoundingClientRect();
    const standalone = matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;
    box.textContent = [
      `innen   ${innerWidth} x ${innerHeight}`,
      `bild    ${screen.width} x ${screen.height}`,
      `sichtb. ${Math.round(visualViewport?.width ?? 0)} x ${Math.round(visualViewport?.height ?? 0)}`,
      `app     ${app ? `${Math.round(app.top)}..${Math.round(app.bottom)}` : '-'}`,
      `safe-unten ${probe.offsetHeight}px`,
      `standalone ${standalone ? 'ja' : 'nein'}`,
    ].join('\n');
  };
  update();
  setInterval(update, 700);
  addEventListener('resize', update);
}
