import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Check } from 'lucide-preact';

/** Textfeld, das mit dem Inhalt wächst. Nutzt das echte iOS-Textfeld (Tastatur, Lupe, Rechtschreibung). */
export function AutoText(props: {
  value: string;
  onInput: (v: string) => void;
  placeholder?: string;
  class?: string;
  autoFocus?: boolean;
  enterKeyHint?: 'next' | 'done' | 'enter';
  /** Return erzeugt Eintrag statt Zeilenumbruch */
  onEnter?: () => void;
  /** Rückschritt in leerem Feld */
  onBackspaceEmpty?: () => void;
  singleLine?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };
  useLayoutEffect(fit, [props.value]);
  useLayoutEffect(() => {
    if (props.autoFocus) ref.current?.focus({ preventScroll: false });
  }, []);

  return (
    <textarea
      ref={ref}
      rows={1}
      class={props.class}
      value={props.value}
      placeholder={props.placeholder}
      enterkeyhint={props.enterKeyHint}
      autocapitalize="sentences"
      onInput={(e) => props.onInput((e.target as HTMLTextAreaElement).value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (props.onEnter || props.singleLine) && !e.shiftKey) {
          e.preventDefault();
          if (props.onEnter) props.onEnter();
          else (e.target as HTMLElement).blur();
        } else if (e.key === 'Backspace' && props.onBackspaceEmpty && props.value === '') {
          e.preventDefault();
          props.onBackspaceEmpty();
        }
      }}
    />
  );
}

export function CheckCircle(props: { done: boolean; onToggle: () => void }) {
  return (
    <button class={'check' + (props.done ? ' done' : '')} onClick={props.onToggle} aria-label="Erledigt">
      <Check size={15} strokeWidth={3.4} />
    </button>
  );
}

export interface MenuItem {
  label: string;
  icon?: ComponentChildren;
  destructive?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

/** Kontextmenü im Glas-Stil, wächst aus dem Knopf heraus. */
export function Menu(props: { anchor: DOMRect; items: MenuItem[]; onClose: () => void }) {
  const host = document.getElementById('app')!.getBoundingClientRect();
  const w = Math.min(280, host.width - 24);
  const left = Math.max(12, Math.min(props.anchor.right - host.left - w, host.width - w - 12));
  const top = props.anchor.bottom - host.top + 8;
  return (
    <>
      <div class="menu-backdrop" onClick={props.onClose} />
      <div class="menu glass strong" style={{ left: `${left}px`, top: `${top}px`, width: `${w}px` }}>
        {props.items.map((it, i) => (
          <>
            {it.separatorBefore && i > 0 && <div class="menu-sep" />}
            <button
              key={it.label}
              class={'menu-item' + (it.destructive ? ' destructive' : '')}
              onClick={() => {
                props.onClose();
                it.onSelect();
              }}
            >
              <span>{it.label}</span>
              {it.icon}
            </button>
          </>
        ))}
      </div>
    </>
  );
}

/** Aktionsblatt von unten (Bestätigungen). */
export function Sheet(props: {
  title?: string;
  actions: { label: string; destructive?: boolean; onSelect: () => void }[];
  onClose: () => void;
}) {
  return (
    <>
      <div class="sheet-backdrop" onClick={props.onClose} />
      <div class="sheet glass strong">
        {props.title && <div class="sheet-title">{props.title}</div>}
        {props.actions.map((a) => (
          <button
            key={a.label}
            class={'menu-item' + (a.destructive ? ' destructive' : '')}
            onClick={() => {
              props.onClose();
              a.onSelect();
            }}
          >
            {a.label}
          </button>
        ))}
        <div class="menu-sep" />
        <button class="menu-item" style={{ fontWeight: 600, color: 'var(--tint)' }} onClick={props.onClose}>
          Abbrechen
        </button>
      </div>
    </>
  );
}

/** Zeile, die sich nach links wischen lässt und „Löschen“ zeigt (wie in Mail und Notizen). */
export function SwipeRow(props: { onTap: () => void; onDelete: () => void; children: ComponentChildren }) {
  const REVEAL = 96;
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number; moved: boolean } | null>(null);

  const down = (e: PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: x, moved: false };
  };
  const move = (e: PointerEvent) => {
    const s = start.current;
    if (!s) return;
    const dx = e.clientX - s.x;
    if (!s.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(e.clientY - s.y)) {
      s.moved = true;
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
    if (s.moved) {
      let nx = s.base + dx;
      if (nx > 0) nx = nx * 0.2;
      if (nx < -REVEAL) nx = -REVEAL + (nx + REVEAL) * 0.35; // Gummiband
      setX(nx);
    }
  };
  const up = () => {
    const s = start.current;
    start.current = null;
    setDragging(false);
    if (!s) return;
    if (!s.moved) {
      if (x < 0) setX(0);
      else props.onTap();
      return;
    }
    setX(x < -REVEAL / 2 ? -REVEAL : 0);
  };

  return (
    <div class="row-wrap">
      <button
        class="row-del"
        style={{ width: `${Math.max(0, -x)}px`, transition: dragging ? 'none' : 'width 0.4s var(--ease)' }}
        onClick={props.onDelete}
        tabIndex={x < 0 ? 0 : -1}
      >
        Löschen
      </button>
      <div
        class="row"
        style={{
          transform: `translateX(${x}px)`,
          transition: dragging ? 'none' : 'transform 0.4s var(--ease)',
          touchAction: 'pan-y',
        }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          start.current = null;
          setDragging(false);
          setX(0);
        }}
        role="button"
        tabIndex={0}
      >
        {props.children}
      </div>
    </div>
  );
}

/** Setzt die Klasse "scrolled" am Bildschirm, sobald der große Titel wegscrollt. */
export function useScrolled() {
  const [scrolled, set] = useState(false);
  return {
    scrolled,
    onScroll: (e: Event) => set((e.currentTarget as HTMLElement).scrollTop > 36),
  };
}
