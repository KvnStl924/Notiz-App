import { useEffect, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Ellipsis, House, Plus, ShoppingBasket, ShoppingCart, Utensils } from 'lucide-preact';
import { isDone, type ShopItem } from './model';
import { shop, store, useShopping } from './store';
import { AutoText, Menu, type MenuItem, Sheet, SwipeRow, useScrolled } from './ui';

function Pill(props: { active: boolean; tone: 'home' | 'bought'; icon: ComponentChildren; onClick: () => void; children: string }) {
  return (
    <button
      class={`pill ${props.tone}` + (props.active ? ' on' : '')}
      aria-pressed={props.active}
      onClick={props.onClick}
    >
      {props.icon}
      {props.children}
    </button>
  );
}

function Row(props: { item: ShopItem; focus: boolean }) {
  const { item } = props;
  const custom = item.recipeId === null;
  const toggle = (k: 'home' | 'bought') => {
    item[k] = !item[k];
    shop.save(item);
  };
  return (
    <SwipeRow class={'shop-wrap' + (isDone(item) ? ' done' : '')} onDelete={() => shop.remove(item.id)}>
      <div class={'shop-row' + (isDone(item) ? ' done' : '')}>
        <div class="shop-line">
          {custom ? (
            <AutoText
              class="shop-name"
              value={item.name}
              placeholder="Artikel"
              autoFocus={props.focus}
              singleLine
              enterKeyHint="done"
              onInput={(v) => {
                item.name = v;
                shop.save(item);
              }}
              onBlur={() => {
                if (!item.name.trim()) shop.remove(item.id);
              }}
            />
          ) : (
            <div class="shop-name">{item.name}</div>
          )}
          {item.amount && <div class="shop-amount">{item.amount}</div>}
        </div>
        <div class="pills">
          <Pill active={item.home} tone="home" icon={<House size={16} strokeWidth={2.2} />} onClick={() => toggle('home')}>
            Zuhause
          </Pill>
          <Pill active={item.bought} tone="bought" icon={<ShoppingBasket size={16} strokeWidth={2.2} />} onClick={() => toggle('bought')}>
            Gekauft
          </Pill>
        </div>
      </div>
    </SwipeRow>
  );
}

export function ShopScreen() {
  const items = useShopping();
  const { scrolled, onScroll } = useScrolled();
  const [menu, setMenu] = useState<{ anchor: DOMRect; items: MenuItem[] } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  // Beim Verlassen leere eigene Einträge entfernen
  useEffect(() => () => shop.removeWhere((i) => i.recipeId === null && !i.name.trim()), []);

  const done = items.filter(isDone).length;

  // Gruppen: je Rezept ein Abschnitt (in der Reihenfolge des Hinzufügens), eigene Einträge zuletzt
  const groups: { key: string; title: string; recipe: boolean; items: ShopItem[] }[] = [];
  for (const i of items) {
    const key = i.recipeId ?? '_own';
    let g = groups.find((x) => x.key === key);
    if (!g) {
      g = {
        key,
        title: i.recipeId ? store.get(i.recipeId)?.title || i.recipeTitle || 'Rezept' : 'Eigene Einträge',
        recipe: i.recipeId !== null,
        items: [],
      };
      groups.push(g);
    }
    g.items.push(i);
  }
  groups.sort((a, b) => Number(!a.recipe) - Number(!b.recipe));
  // Reihenfolge bleibt wie hinzugefügt: abgehakte Posten wandern nicht

  const showMenu = (e: MouseEvent) =>
    setMenu({
      anchor: (e.currentTarget as HTMLElement).getBoundingClientRect(),
      items: [
        {
          label: 'Erledigte entfernen',
          icon: <ShoppingBasket size={20} />,
          onSelect: () => shop.removeWhere(isDone),
        },
        {
          label: 'Liste leeren',
          icon: <Ellipsis size={20} />,
          destructive: true,
          separatorBefore: true,
          onSelect: () => setConfirmClear(true),
        },
      ],
    });

  return (
    <div class={scrolled ? 'scrolled' : ''} style={{ display: 'contents' }}>
      <div class="navbar">
        <div class="navbar-bg" />
        <div class="nav-title">Einkauf</div>
        <span />
        <div class="glass" style={{ borderRadius: '22px', display: 'flex' }}>
          <button class="nav-btn round tint" onClick={(e) => showMenu(e as unknown as MouseEvent)} aria-label="Mehr">
            <Ellipsis size={22} />
          </button>
          <button
            class="nav-btn round tint"
            aria-label="Eigenen Eintrag hinzufügen"
            onClick={() => setFocusId(shop.addCustom().id)}
          >
            <Plus size={24} strokeWidth={2.2} />
          </button>
        </div>
      </div>

      <div class={'scroll' + (scrolled ? ' scrolled' : '')} onScroll={onScroll}>
        <h1 class="large-title" style={{ marginBottom: '4px' }}>
          Einkauf
        </h1>
        {items.length > 0 && (
          <p class="shop-summary">{done === items.length ? 'Alles erledigt' : `${done} von ${items.length} erledigt`}</p>
        )}

        {items.length === 0 ? (
          <div class="empty">
            <ShoppingCart size={46} strokeWidth={1.4} />
            <h3>Die Einkaufsliste ist leer</h3>
            <p>Öffne ein Rezept und tippe auf „Zur Einkaufsliste hinzufügen“. Mit dem Plus legst du eigene Einträge an.</p>
          </div>
        ) : (
          groups.map((g) => (
            <section key={g.key}>
              <header class="shop-head">
                <span class="shop-head-title">
                  {g.recipe && <Utensils size={15} />}
                  {g.title}
                </span>
                <span>
                  {g.items.filter(isDone).length}/{g.items.length}
                </span>
              </header>
              <div class="group glass">
                {g.items.map((i) => (
                  <Row key={i.id} item={i} focus={focusId === i.id} />
                ))}
              </div>
            </section>
          ))
        )}
        {items.length > 0 && <p class="section-footer">Zuhause = habe ich schon. Gekauft = im Laden erledigt. Nach links wischen zum Löschen.</p>}
      </div>

      {menu && <Menu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
      {confirmClear && (
        <Sheet
          title="Die ganze Einkaufsliste wird gelöscht."
          actions={[{ label: 'Liste leeren', destructive: true, onSelect: () => shop.removeWhere(() => true) }]}
          onClose={() => setConfirmClear(false)}
        />
      )}
    </div>
  );
}
