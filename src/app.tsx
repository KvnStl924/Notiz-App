import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FileText, ShoppingCart, Utensils } from 'lucide-preact';
import { isDone, type NoteType } from './model';
import { createNote, EditorScreen, ListScreen, TAB_TITLE, type Tab } from './screens';
import { ShopScreen } from './shop-screen';
import { useShopping } from './store';

interface Open {
  id: string;
  focusTitle: boolean;
  /** Beschriftung des Zurück-Knopfes, beim Öffnen festgehalten */
  backLabel: string;
}

/** Wie weit der Hintergrund-Bildschirm beim Push nach links wandert (iOS: ~30 %). */
const PARALLAX = 0.3;
/** Jede geöffnete Notiz bekommt einen Verlaufseintrag (#note-…), damit die Android-Zurück-Geste und die Zurücktaste den Editor schließen. */
const HASH = '#note-';
const clearHash = () => {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* Verlauf nicht erlaubt */
  }
};
const hostWidth = () => document.getElementById('app')!.clientWidth;

export function App() {
  const [tab, setTab] = useState<Tab>('recipe');
  const openShopping = useShopping().filter((i) => !isDone(i)).length;
  const [open, setOpen] = useState<Open | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const edRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  /** p = 0: Editor draußen, p = 1: Editor ganz offen. */
  const setProgress = (p: number) => {
    const w = hostWidth();
    if (edRef.current) edRef.current.style.transform = `translate3d(${(1 - p) * w}px,0,0)`;
    if (rootRef.current) rootRef.current.style.transform = `translate3d(${-p * PARALLAX * w}px,0,0)`;
    if (dimRef.current) dimRef.current.style.opacity = String(p * 0.28);
  };

  const animateTo = (p: number, done?: () => void) => {
    const els = [rootRef.current, dimRef.current, edRef.current].filter(Boolean) as HTMLElement[];
    els.forEach((e) => e.classList.add('animating'));
    setProgress(p);
    window.setTimeout(() => {
      els.forEach((e) => e.classList.remove('animating'));
      done?.();
    }, 430);
  };

  // Push-Animation, sobald der Editor eingehängt ist
  useLayoutEffect(() => {
    if (!open) return;
    closing.current = false;
    setProgress(0);
    edRef.current?.getBoundingClientRect(); // Layout erzwingen
    animateTo(1);
  }, [open?.id]);

  const openNote = (id: string, focusTitle = false) => {
    try {
      if (location.hash.startsWith(HASH)) clearHash(); // übrig gebliebener Eintrag
      location.hash = HASH.slice(1) + id;
    } catch {
      /* Verlauf nicht erlaubt: Zurück läuft dann nur über die Oberfläche */
    }
    setOpen({ id, focusTitle, backLabel: TAB_TITLE[tabRef.current] });
  };

  const close = (fromNavigation = false) => {
    if (closing.current) return;
    closing.current = true;
    animateTo(0, () => {
      setOpen(null);
      if (rootRef.current) rootRef.current.style.transform = '';
    });
    if (!fromNavigation && location.hash.startsWith(HASH)) history.back();
  };

  // Android-Zurück-Geste und -Taste (und die iOS-Systemgeste, falls vorhanden)
  useEffect(() => {
    if (location.hash.startsWith(HASH)) clearHash(); // Neuladen auf einer Notiz: Startseite zeigen
    const onNav = () => {
      if (edRef.current && !location.hash.startsWith(HASH)) close(true);
    };
    window.addEventListener('hashchange', onNav);
    window.addEventListener('popstate', onNav);
    return () => {
      window.removeEventListener('hashchange', onNav);
      window.removeEventListener('popstate', onNav);
    };
  }, []);

  // Wischen vom linken Rand zurück
  const drag = useRef<{ x: number; t: number; id: number } | null>(null);
  const onEdgeDown = (e: PointerEvent) => {
    drag.current = { x: e.clientX, t: performance.now(), id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    [rootRef.current, dimRef.current, edRef.current].forEach((el) => el?.classList.remove('animating'));
  };
  const onEdgeMove = (e: PointerEvent) => {
    if (!drag.current) return;
    const dx = Math.max(0, e.clientX - drag.current.x);
    setProgress(1 - dx / hostWidth());
  };
  const onEdgeUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const v = dx / Math.max(1, performance.now() - d.t); // px pro ms
    if (dx > hostWidth() * 0.4 || v > 0.5) close();
    else animateTo(1);
  };

  const newNote = () => {
    const n = createNote(tab as NoteType);
    openNote(n.id, true);
  };

  return (
    <>
      <div class="screen" ref={rootRef}>
        <div key={tab} style={{ display: 'contents', animation: 'fade-in .25s var(--ease)' }}>
          {tab === 'shopping' ? (
            <ShopScreen />
          ) : (
            <ListScreen type={tab} onOpen={(id) => openNote(id)} onNew={newNote} />
          )}
        </div>

        <nav class="tabbar glass" aria-label="Bereiche">
          {(['recipe', 'note', 'shopping'] as Tab[]).map((t) => (
            <button key={t} class={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
              <span class="tab-icon">
                {t === 'recipe' ? (
                  <Utensils size={26} strokeWidth={1.9} />
                ) : t === 'note' ? (
                  <FileText size={26} strokeWidth={1.9} />
                ) : (
                  <ShoppingCart size={26} strokeWidth={1.9} />
                )}
                {t === 'shopping' && openShopping > 0 && <span class="badge">{openShopping}</span>}
              </span>
              {TAB_TITLE[t]}
            </button>
          ))}
        </nav>
      </div>

      <div class="dim" ref={dimRef} />

      {open && (
        <div class="screen top" ref={edRef} style={{ transform: 'translate3d(100%,0,0)' }}>
          <div class="edge" onPointerDown={onEdgeDown} onPointerMove={onEdgeMove} onPointerUp={onEdgeUp} onPointerCancel={onEdgeUp} />
          <EditorScreen
            key={open.id}
            id={open.id}
            backLabel={open.backLabel}
            focusTitle={open.focusTitle}
            onBack={() => close()}
            onShowShopping={() => {
              setTab('shopping');
              close();
            }}
          />
        </div>
      )}
    </>
  );
}
