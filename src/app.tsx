import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FileText, Utensils } from 'lucide-preact';
import type { NoteType } from './model';
import { createNote, EditorScreen, ListScreen, TAB_TITLE } from './screens';

interface Open {
  id: string;
  focusTitle: boolean;
}

/** Wie weit der Hintergrund-Bildschirm beim Push nach links wandert (iOS: ~30 %). */
const PARALLAX = 0.3;

export function App() {
  const [tab, setTab] = useState<NoteType>('recipe');
  const [open, setOpen] = useState<Open | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const edRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const tabRef = useRef(tab);
  tabRef.current = tab;

  /** p = 0: Editor draußen, p = 1: Editor ganz offen. */
  const setProgress = (p: number) => {
    const w = window.innerWidth;
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
    history.pushState({ editor: id }, '');
    setOpen({ id, focusTitle });
  };

  const close = (fromPopstate = false) => {
    if (closing.current) return;
    closing.current = true;
    animateTo(0, () => {
      setOpen(null);
      if (rootRef.current) rootRef.current.style.transform = '';
    });
    if (!fromPopstate && history.state?.editor) history.back();
  };

  // Android-Zurücktaste und iOS-Systemgeste
  useEffect(() => {
    const onPop = () => {
      if (edRef.current) close(true);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  });

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
    setProgress(1 - dx / window.innerWidth);
  };
  const onEdgeUp = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const dx = e.clientX - d.x;
    const v = dx / Math.max(1, performance.now() - d.t); // px pro ms
    if (dx > window.innerWidth * 0.4 || v > 0.5) close();
    else animateTo(1);
  };

  const newNote = () => {
    const n = createNote(tab);
    openNote(n.id, true);
  };

  return (
    <>
      <div class="screen" ref={rootRef}>
        <div key={tab} style={{ display: 'contents', animation: 'fade-in .25s var(--ease)' }}>
          <ListScreen type={tab} onOpen={(id) => openNote(id)} onNew={newNote} />
        </div>

        <nav class="tabbar glass" aria-label="Bereiche">
          {(['recipe', 'note'] as NoteType[]).map((t) => (
            <button key={t} class={'tab' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>
              {t === 'recipe' ? <Utensils size={26} strokeWidth={1.9} /> : <FileText size={26} strokeWidth={1.9} />}
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
            backLabel={TAB_TITLE[tabRef.current]}
            focusTitle={open.focusTitle}
            onBack={() => close()}
          />
        </div>
      )}
    </>
  );
}
