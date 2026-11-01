import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { FileText, ShoppingCart, Utensils } from 'lucide-preact';
import { isDone, type NoteType } from './model';
import { createNote, EditorScreen, ListScreen, TAB_TITLE, type Tab } from './screens';
import { ShopScreen } from './shop-screen';
import { SyncButton, SyncPanel } from './sync-ui';
import { useShopping } from './store';
import { useInbox } from './inbox';
import { Toast } from './ui';
import { useUpdateAvailable } from './update';

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
  const updateReady = useUpdateAvailable();
  const inboxState = useInbox();
  const openShopping = useShopping().filter((i) => !isDone(i)).length;
  const [open, setOpen] = useState<Open | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const dimRef = useRef<HTMLDivElement>(null);
  const edRef = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const tabRef = useRef(tab);
  // Richtung des letzten Tabwechsels (für die Wischanimation); 0 = beim Start nur einblenden
  const slideDir = useRef<0 | 1 | -1 | 2>(0);
  const swipe = useRef<{ x: number; y: number; t: number; ok: boolean; dir: number } | null>(null);
  const SWIPE_EXCLUDE =
    'textarea, input, .row-wrap, .shop-wrap, .tbl, .table-scroll, .li, .card, .tabbar, .panel, .sheet, .menu, .sync-btn';
  // Während eines Wischens: Verschiebung und Ziel-Tab (wird nicht in der Liste gespeichert, nur für die Anzeige)
  const [wipe, setWipe] = useState<{ x: number; to: Tab | null; settle: boolean } | null>(null);
  const dragRef = useRef<{ x: number; to: Tab | null } | null>(null);
  const TABS_ORDER: Tab[] = ['recipe', 'note', 'shopping'];
  const renderTab = (t: Tab) =>
    t === 'shopping' ? <ShopScreen /> : <ListScreen type={t} onOpen={(id) => openNote(id)} onNew={newNote} />;
  const pageStyle = (x: number, settle: boolean) => ({
    transform: `translate3d(${x}px,0,0)`,
    transition: settle ? 'transform .38s var(--ease)' : 'none',
  });
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

  /** Einrasten: auf den Ziel-Tab oder zurück an den Ausgangspunkt, dann Wischzustand lösen. */
  const settleTo = (to: Tab | null, x: number) => {
    setWipe({ x, to, settle: true });
    window.setTimeout(() => {
      if (to) {
        slideDir.current = 2; // Tabwechsel ohne zweite Animation
        setTab(to);
      }
      dragRef.current = null;
      setWipe(null);
    }, 380);
  };

  return (
    <>
      <div
        class="screen"
        ref={rootRef}
        onPointerDown={(e) => {
          const ok = !(e.target as HTMLElement).closest(SWIPE_EXCLUDE);
          swipe.current = { x: e.clientX, y: e.clientY, t: performance.now(), ok, dir: 0 };
        }}
        onPointerMove={(e) => {
          const s = swipe.current;
          if (!s || !s.ok) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (s.dir === 0) {
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
              s.ok = false; // senkrecht: normales Scrollen
              return;
            }
            if (Math.abs(dx) < 8) return;
            s.dir = 1;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }
          const i = TABS_ORDER.indexOf(tabRef.current);
          const to = dx < 0 ? (TABS_ORDER[i + 1] ?? null) : (TABS_ORDER[i - 1] ?? null);
          const w = hostWidth();
          // Am ersten oder letzten Tab zieht man nur halb so weit (Gummiband wie bei iOS)
          const x = Math.max(-w, Math.min(w, to ? dx : dx * 0.35));
          dragRef.current = { x, to };
          setWipe({ x, to, settle: false });
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s || s.dir === 0) return;
          const cur = dragRef.current;
          if (!cur) return;
          const w = hostWidth();
          const v = (e.clientX - s.x) / Math.max(1, performance.now() - s.t); // px pro ms
          const commit = !!cur.to && (Math.abs(cur.x) > w * 0.3 || Math.abs(v) > 0.5);
          const dir = cur.x < 0 ? -1 : 1;
          settleTo(commit ? cur.to : null, commit ? -dir * w : 0);
        }}
        onPointerCancel={() => {
          swipe.current = null;
          if (dragRef.current) settleTo(null, 0);
        }}
      >
        <div
          key={tab}
          class="tab-page"
          style={
            wipe
              ? pageStyle(wipe.x, wipe.settle)
              : {
                  animation:
                    slideDir.current === 2
                      ? undefined
                      : slideDir.current === 0
                        ? 'fade-in .25s var(--ease)'
                        : `${slideDir.current > 0 ? 'tab-in-r' : 'tab-in-l'} .34s var(--ease)`,
                }
          }
        >
          {renderTab(tab)}
        </div>
        {wipe && wipe.to && (
          <div
            key={'next-' + wipe.to}
            class="tab-page"
            style={pageStyle(
              (TABS_ORDER.indexOf(wipe.to) > TABS_ORDER.indexOf(tab) ? hostWidth() : -hostWidth()) + wipe.x,
              wipe.settle,
            )}
          >
            {renderTab(wipe.to)}
          </div>
        )}

        <SyncButton />

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
      <SyncPanel />
      {inboxState.notice && (
        <Toast
          text={`Neues Rezept von Claude: ${inboxState.notice.title}`}
          action={{
            label: 'Ansehen',
            run: () => {
              const id = inboxState.notice!.id;
              inboxState.clearNotice();
              setTab('recipe');
              openNote(id);
            },
          }}
        />
      )}
      {updateReady && <Toast class="update" text="Neue Version verfügbar" action={{ label: 'Aktualisieren', run: () => location.reload() }} />}

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
