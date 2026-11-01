import { useEffect, useState } from 'preact/hooks';

const fileName = (u: string) => u.split('/').pop()!.split('?')[0];

/** Name der Programmdatei, die gerade läuft (nur im gebauten Zustand, nicht im Entwicklungsmodus). */
function runningBundle(): string | null {
  const s = [...document.scripts].find((x) => /\/assets\/index-[\w-]+\.js/.test(x.src));
  return s ? fileName(s.src) : null;
}

/** Gibt es online eine neuere Version als die, die gerade läuft? */
export async function newVersionAvailable(): Promise<boolean> {
  const cur = runningBundle();
  if (!cur) return false;
  try {
    const res = await fetch(new URL('index.html', document.baseURI), { cache: 'no-store' });
    if (!res.ok) return false;
    const m = (await res.text()).match(/assets\/(index-[\w-]+\.js)/);
    return !!m && m[1] !== cur;
  } catch {
    return false; // offline o. Ä.: kein Hinweis
  }
}

/** Prüft nach dem Start, alle 5 Minuten und wenn die App wieder in den Vordergrund kommt. */
export function useUpdateAvailable(): boolean {
  const [available, set] = useState(false);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      if (alive && (await newVersionAvailable())) set(true);
    };
    const first = setTimeout(check, 3000);
    const every = setInterval(check, 5 * 60_000);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return available;
}
