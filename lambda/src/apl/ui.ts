/**
 * APL building blocks in the light naturgarten.bio look (docs/DESIGN.md in the main repo):
 * off-white ground, white cards with a thin border, brown and leaf-green accents. APL cannot
 * load web fonts, so the device fonts stand in: Bookerly (serif) for Cormorant Garamond,
 * Amazon Ember Display for Open Sans.
 *
 * Sizes are relative to the viewport (vh in landscape, vw in portrait), so one layout serves
 * Echo Show 8/10 (1280×800) and 15/21 (1920×1080) alike; Echo Show 5 gets its own numbers.
 */
import type { ViewportKind } from '../context';

export const C = {
  bg: '#FAFAFA',
  card: '#FFFFFF',
  border: '#E6E1D8',
  text: '#2B2B2B',
  muted: '#6B6560',
  brown: '#5B4A3A',
  green: '#4D7700',
  greenTint: '#EEF3E2',
  festival: '#F6EFE3',
  festivalBorder: '#E2D3BA',
  autumn: '#8A5428',
  moonLight: '#FFFDF5',
};

export const SERIF = 'Bookerly';
export const SANS = 'Amazon Ember Display';

export type Component = Record<string, unknown>;

/** Sizes per viewport, in units of `unit`. */
export interface Sizes {
  unit: 'vh' | 'vw';
  pad: number;
  gap: number;
  title: number;
  subtitle: number;
  body: number;
  label: number;
  value: number;
  small: number;
  cardPad: number;
  radius: number;
  wheel: number;
}

export const SIZES: Record<ViewportKind, Sizes> = {
  landscape: { unit: 'vh', pad: 4.5, gap: 2.2, title: 5.6, subtitle: 3.4, body: 2.9, label: 1.8, value: 4.2, small: 2.4, cardPad: 2.4, radius: 2, wheel: 62 },
  // Echo Show 5 (960×480, 2:1): wheel 84 % leaves ~220 px per card; values ~24 px, labels
  // ~12.5 px, sub texts ~16 px — readable from a few metres. (Checked at the real 2:1 in the
  // console simulator, skill screen-check; an earlier 1.6:1 preview made everything look too big.)
  small: { unit: 'vh', pad: 4, gap: 2, title: 6.2, subtitle: 4, body: 3.6, label: 2.6, value: 5.0, small: 3.3, cardPad: 2.8, radius: 2.8, wheel: 84 },
  portrait: { unit: 'vw', pad: 6, gap: 2.4, title: 5.6, subtitle: 3.5, body: 3, label: 1.8, value: 4.4, small: 2.3, cardPad: 3, radius: 2, wheel: 84 },
};

export const dim = (s: Sizes, n: number): string => `${Math.round(n * 100) / 100}${s.unit}`;

/** Space between siblings: APL puts `spacing` on every child but the first. */
export function spaced(items: (Component | null | undefined | false)[], gap: string): Component[] {
  return items.filter((c): c is Component => Boolean(c)).map((c, i) => (i === 0 ? c : { ...c, spacing: gap }));
}

export function text(
  value: string,
  size: string,
  opts: { serif?: boolean; bold?: boolean; color?: string; maxLines?: number; align?: 'left' | 'center' | 'right'; grow?: boolean; upper?: boolean } = {},
): Component {
  return {
    type: 'Text',
    text: escapeApl(opts.upper ? value.toUpperCase() : value),
    fontSize: size,
    fontFamily: opts.serif ? SERIF : SANS,
    fontWeight: opts.bold ? 'bold' : 'normal',
    color: opts.color ?? C.text,
    ...(opts.upper ? { letterSpacing: '1dp' } : {}),
    ...(opts.maxLines ? { maxLines: opts.maxLines } : {}),
    ...(opts.align ? { textAlign: opts.align } : {}),
    // No basis 0 here: in a row that is not stretched, such a text collapses to nothing.
    ...(opts.grow ? { grow: 1, shrink: 1 } : {}),
  };
}

/** APL Text treats `${…}` as data binding and `<…>` as markup; API text must stay literal. */
export const escapeApl = (value: string): string =>
  noBinding(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** APL evaluates `${…}` in every string, not only in Text: labels and event arguments need it broken too. */
export const noBinding = (value: string): string => value.replace(/\$\{/g, '$ {');

export function row(items: (Component | null | undefined | false)[], gap: string, extra: Component = {}): Component {
  return { type: 'Container', direction: 'row', items: spaced(items, gap), ...extra };
}

export function column(items: (Component | null | undefined | false)[], gap: string, extra: Component = {}): Component {
  return { type: 'Container', direction: 'column', items: spaced(items, gap), ...extra };
}

/**
 * A box: white card with border, or a tinted one; tappable with `tap`.
 *
 * Built on a Container, not a Frame: Frame and TouchWrapper never stretch their single child, so a
 * row inside stayed as wide as its text (the garden tip ran off the screen, a „›“ sat right after
 * the text), and the schema allows neither `alignSelf` nor a percentage width to fix that. In a
 * Container the content is an ordinary child and gets the full width; the Frame (background,
 * border) lies behind it and the TouchWrapper over it, both stretched by absolute position.
 */
export function box(
  item: Component,
  s: Sizes,
  opts: { fill?: string; border?: string; pad?: number; extra?: Component; tap?: { args: string[]; label: string } } = {},
): Component {
  const pad = dim(s, opts.pad ?? s.cardPad);
  const fill = { position: 'absolute', top: '0dp', bottom: '0dp', left: '0dp', right: '0dp' };
  return {
    type: 'Container',
    paddingLeft: pad,
    paddingRight: pad,
    paddingTop: pad,
    paddingBottom: pad,
    items: [
      {
        type: 'Frame',
        ...fill,
        backgroundColor: opts.fill ?? C.card,
        borderColor: opts.border ?? (opts.fill && opts.fill !== C.card ? opts.fill : C.border),
        borderWidth: '2dp',
        borderRadius: dim(s, s.radius),
      },
      item,
      opts.tap ? { type: 'TouchWrapper', ...fill, accessibilityLabel: noBinding(opts.tap.label), onPress: [send(opts.tap.args)] } : null,
    ].filter(Boolean),
    ...opts.extra,
  };
}

const send = (args: string[]) => ({ type: 'SendEvent', arguments: args.map(noBinding) });

/** Tappable: sends a UserEvent the skill answers like the matching intent. For boxes use `box(…, { tap })`. */
export function tap(item: Component, args: string[], label: string, extra: Component = {}): Component {
  return {
    type: 'TouchWrapper',
    accessibilityLabel: noBinding(label),
    onPress: [send(args)],
    item,
    ...extra,
  };
}

/** „‹ Jahresrad“ at the top of every detail screen: back to the wheel (same as saying „zurück“). */
export function backChip(s: Sizes): Component {
  return tap(text('‹ Jahresrad', dim(s, s.small), { bold: true, color: C.green, maxLines: 1 }), ['nav', 'home'], 'Zurück zum Jahresrad', {
    alignSelf: 'start',
  });
}

/** A complete APL document around one root component. */
export function document(root: Component, graphics: Record<string, unknown> = {}): Component {
  return {
    type: 'APL',
    version: '2023.3',
    theme: 'light',
    background: C.bg,
    settings: { idleTimeout: 600000 },
    ...(Object.keys(graphics).length ? { graphics } : {}),
    mainTemplate: { parameters: [], items: [root] },
  };
}

export function screenRoot(items: Component[], s: Sizes, gap: string, direction: 'row' | 'column' = 'column', extra: Component = {}): Component {
  const pad = dim(s, s.pad);
  return {
    type: 'Container',
    direction,
    width: '100vw',
    height: '100vh',
    paddingLeft: pad,
    paddingRight: pad,
    paddingTop: pad,
    paddingBottom: pad,
    items: spaced(items, gap),
    ...extra,
  };
}

// ---------- the moon as vector graphic ----------

/**
 * The lit part of the moon disc. `lit` is the illuminated fraction (0…1); waxing light is on
 * the right (northern hemisphere). The terminator is half an ellipse with rx = r·|1 − 2·lit|.
 */
export function moonLitPath(lit: number, waxing: boolean, r: number, cx: number, cy: number): string {
  const k = Math.min(1, Math.max(0, lit));
  const rx = Math.round(r * Math.abs(1 - 2 * k) * 100) / 100;
  const top = `${cx},${cy - r}`;
  const bottom = `${cx},${cy + r}`;
  // Outer edge: right half when waxing (clockwise), left half when waning.
  const outer = `A${r},${r} 0 0 ${waxing ? 1 : 0} ${bottom}`;
  // Back along the terminator: crescent bulges towards the lit side, gibbous away from it.
  const crescent = k < 0.5;
  const sweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
  return `M${top} ${outer} A${rx},${r} 0 0 ${sweep} ${top} Z`;
}

/** AVG for a moon disc of `size` units: dark disc, lit part, outline. */
export function moonGraphic(lit: number, waxing: boolean, size = 200): Record<string, unknown> {
  const r = size / 2 - 4;
  const c = size / 2;
  return {
    type: 'AVG',
    version: '1.2',
    width: size,
    height: size,
    items: [
      { type: 'path', pathData: circlePath(c, c, r), fill: C.brown },
      { type: 'path', pathData: moonLitPath(lit, waxing, r, c, c), fill: C.moonLight },
      { type: 'path', pathData: circlePath(c, c, r), stroke: C.brown, strokeWidth: Math.max(2, size / 60) },
    ],
  };
}

const circlePath = (cx: number, cy: number, r: number) => `M${cx - r},${cy} A${r},${r} 0 1 0 ${cx + r},${cy} A${r},${r} 0 1 0 ${cx - r},${cy} Z`;

/** Lit fraction and side of the four main phases (list icons). */
export const QUARTER_LOOK: Record<string, { lit: number; waxing: boolean }> = {
  new_moon: { lit: 0, waxing: true },
  first_quarter: { lit: 0.5, waxing: true },
  full_moon: { lit: 1, waxing: true },
  last_quarter: { lit: 0.5, waxing: false },
};
