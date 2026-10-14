/**
 * The six screens: main (daily briefing), festival, moon, garden tasks, help, error.
 * Each returns a complete APL document with the data written in; touch targets send
 * UserEvents `['nav', target, param?]` (handlers/touch.ts).
 */
import type { Day, Festival, Image, Moon, MoonGarden, Task } from '../api/types';
import type { ViewportKind } from '../context';
import { clean, daysBetween, longDate, screenDate, screenDuration, shortDate } from '../speech/format';
import {
  C,
  SIZES,
  backChip,
  box,
  column,
  dim,
  document,
  moonGraphic,
  QUARTER_LOOK,
  row,
  screenRoot,
  tap,
  text,
  type Component,
  type Sizes,
} from './ui';

export interface Screen {
  token: string;
  document: Component;
}

// ---------- main ----------

/** The wheel-only image for the device: 600 px on Echo Show 5, 1080 px elsewhere. */
export function pickWheel(image: Image | null | undefined, kind: ViewportKind): string | undefined {
  const variants = image?.variants ?? [];
  const want = kind === 'small' ? 'rad-600x600' : 'rad-1080x1080';
  const exact = variants.find((v) => v.url.includes(`/${want}.`));
  const anyWheel = variants.find((v) => v.url.includes('/rad-'));
  // Before the wheel-only images exist: the square image with text is still better than nothing.
  const square = variants.find((v) => v.width === v.height);
  return (exact ?? anyWheel ?? square)?.url;
}

interface CardSpec {
  label: string;
  value: string;
  sub?: string;
  args: string[];
  festive?: boolean;
}

function card(c: CardSpec, s: Sizes): Component {
  const inner = column(
    [
      text(c.label, dim(s, s.label), { bold: true, color: C.muted, upper: true, maxLines: 1 }),
      // Long values („Zunehmende Sichel“) a size smaller: a word wider than the card breaks mid-word.
      text(c.value, dim(s, c.value.length > 12 ? s.value * 0.78 : s.value), { serif: true, bold: true, color: c.festive ? C.brown : C.text, maxLines: 2 }),
      c.sub ? text(c.sub, dim(s, s.small), { color: C.muted, maxLines: 2 }) : null,
    ],
    dim(s, 0.6),
  );
  // The frame is the flex child, so cards in a row stretch to the same height; the touch target
  // sits inside it (APL allows no percentage height under an auto-sized TouchWrapper).
  const flex = { grow: 1, shrink: 1, width: '0dp' };
  const tapped = { args: c.args, label: `${c.label}: ${c.value}` };
  return box(inner, s, c.festive ? { fill: C.festival, border: C.festivalBorder, extra: flex, tap: tapped } : { extra: flex, tap: tapped });
}

function mainCards(day: Day, s: Sizes): CardSpec[] {
  const cards: CardSpec[] = [];
  if (day.season) {
    cards.push({ label: 'Naturjahreszeit', value: day.season.name, sub: day.season.indicators?.[0], args: ['nav', 'season'] });
  }
  const m = day.moon;
  const next = m.next_change;
  cards.push({
    label: 'Mond',
    value: m.name,
    sub: `${Math.round(m.illumination * 100)} %${next ? ` · ${next.name} am ${shortDate(next.date)}` : ''}`,
    args: ['nav', 'moon'],
  });
  const f = day.festival.today ?? day.festival.next;
  if (f) {
    const today = Boolean(day.festival.today);
    const days = f.days_until ?? daysBetween(day.date, f.date);
    cards.push({
      label: today ? 'Heute' : 'Nächstes Fest',
      value: f.name,
      sub: today ? (f.epithet ?? undefined) : `in ${days} ${days === 1 ? 'Tag' : 'Tagen'} · ${shortDate(f.date)}`,
      args: ['nav', 'festival', f.id],
      festive: true,
    });
  }
  const dl = day.daylight;
  if (dl.sunrise && dl.sunset) {
    cards.push({ label: 'Tageslicht', value: `${dl.sunrise} – ${dl.sunset}`, sub: `${screenDuration(dl.day_length_min)} hell`, args: ['nav', 'daylight'] });
  }
  return cards;
}

function cardGrid(cards: CardSpec[], s: Sizes): Component {
  const rows: Component[] = [];
  for (let i = 0; i < cards.length; i += 2) {
    const pair = cards.slice(i, i + 2).map((c) => card(c, s));
    if (pair.length === 1) pair.push({ type: 'Container', grow: 1, shrink: 1, width: '0dp' });
    rows.push(row(pair, dim(s, s.gap), { grow: 1 }));
  }
  return column(rows, dim(s, s.gap), { grow: 1 });
}

function subtitleOf(day: Day): string | undefined {
  if (day.festival.today) return `Heute feiern wir ${day.festival.today.name}`;
  if (day.festival.eve) return `Heute Abend beginnt ${day.festival.eve.name}`;
  if (day.period) return /^rau/i.test(day.period.name) ? `${day.period.day}. Rauhnacht` : `${day.period.name}: Tag ${day.period.day} von ${day.period.of}`;
  return undefined;
}

function gardenStrip(day: Day, s: Sizes, compact: boolean): Component | null {
  const task = day.garden.tasks[0];
  if (!task) return null;
  const pad = compact ? s.cardPad * 0.7 : s.cardPad * 0.8;
  return box(
    row(
      [
        text('Gartentipp', dim(s, s.label), { bold: true, color: C.green, upper: true, maxLines: 1 }),
        text(task.title, dim(s, compact ? s.small : s.body * 0.85), { grow: true, maxLines: compact ? 2 : 1 }),
        compact ? null : text('Alle Aufgaben ›', dim(s, s.small), { bold: true, color: C.green, maxLines: 1 }),
      ],
      dim(s, s.gap),
      { alignItems: 'center' },
    ),
    s,
    { fill: C.greenTint, pad, tap: { args: ['nav', 'gardenWeek'], label: `Gartentipp: ${task.title}` } },
  );
}

export function mainScreen(day: Day, kind: ViewportKind, currentYear?: number): Screen {
  const s = SIZES[kind];
  const gap = dim(s, s.gap);
  const wheelUrl = pickWheel(day.image, kind);
  const wheel = wheelUrl
    ? { type: 'Image', source: wheelUrl, width: dim(s, s.wheel), height: dim(s, s.wheel), scale: 'best-fit', accessibilityLabel: `Das Jahresrad am ${longDate(day.date)}` }
    : null;
  const date = longDate(day.date, currentYear);
  const subtitle = subtitleOf(day);
  const place = day.location?.label;
  const cards = cardGrid(mainCards(day, s), s);

  let root: Component;
  if (kind === 'small') {
    root = screenRoot(
      [
        wheel,
        column(
          [text(date, dim(s, s.title * 0.8), { serif: true, bold: true, maxLines: 1 }), cards, gardenStrip(day, s, true)],
          dim(s, s.gap * 0.8),
          { grow: 1, shrink: 1, height: '100%' },
        ),
      ].filter(Boolean) as Component[],
      s,
      gap,
      'row',
      { alignItems: 'center' },
    );
  } else if (kind === 'portrait') {
    root = screenRoot(
      [
        column(
          [
            text(date, dim(s, s.title), { serif: true, bold: true, align: 'center' }),
            subtitle ? text(subtitle, dim(s, s.subtitle), { serif: true, bold: true, color: C.green, align: 'center' }) : null,
          ],
          dim(s, 0.8),
          { alignItems: 'center' },
        ),
        wheel ? { ...wheel, alignSelf: 'center' } : null,
        cards,
        gardenStrip(day, s, false),
      ].filter(Boolean) as Component[],
      s,
      gap,
    );
  } else {
    const header = row(
      [
        row(
          [
            text(date, dim(s, s.title), { serif: true, bold: true, maxLines: 1 }),
            subtitle ? text(subtitle, dim(s, s.subtitle), { serif: true, bold: true, color: C.green, maxLines: 1, grow: true }) : null,
          ],
          dim(s, s.gap),
          { alignItems: 'baseline', grow: 1, shrink: 1 },
        ),
        place ? text(place, dim(s, s.small), { color: C.muted, maxLines: 1 }) : null,
      ],
      gap,
      { alignItems: 'end', justifyContent: 'spaceBetween' },
    );
    root = screenRoot(
      [header, row([wheel, cards], dim(s, s.gap * 1.5), { grow: 1, alignItems: 'center' }), gardenStrip(day, s, false)].filter(
        Boolean,
      ) as Component[],
      s,
      gap,
    );
  }
  return { token: 'mainScreen', document: document(root) };
}

// ---------- festival ----------

export function festivalScreen(f: Festival, todayIso: string, kind: ViewportKind): Screen {
  const s = SIZES[kind];
  const gap = dim(s, s.gap);
  const days = daysBetween(todayIso, f.date);
  const when = days === 0 ? 'Heute' : days > 0 ? `${days === 1 ? '1 Tag' : `${days} Tage`} · ${longDate(f.date)}` : longDate(f.date, Number(todayIso.slice(0, 4)));
  const header = row(
    [
      column(
        [
          text(days === 0 ? 'Heute' : days > 0 ? 'Nächstes Fest' : 'Fest', dim(s, s.label), { bold: true, color: C.muted, upper: true }),
          text(f.name, dim(s, s.title * 1.5), { serif: true, bold: true, maxLines: 1 }),
          f.epithet ? text(f.epithet, dim(s, s.subtitle), { serif: true, bold: true, color: C.green, maxLines: 1 }) : null,
        ],
        dim(s, 0.6),
        { grow: 1, shrink: 1 },
      ),
      column(
        [
          days > 0 ? text(String(days), dim(s, s.title * 1.4), { serif: true, bold: true, color: C.brown, align: 'right' }) : null,
          text(when, dim(s, s.small), { color: C.muted, align: 'right', maxLines: 2 }),
        ],
        dim(s, 0.4),
        { alignItems: 'end', width: kind === 'small' ? '40%' : '35%' },
      ),
    ],
    gap,
    { alignItems: 'center', width: '100%' },
  );
  const sections: Component[] = [];
  const section = (label: string, body: Component, fill?: string) =>
    box(column([text(label, dim(s, s.label), { bold: true, color: fill ? C.green : C.muted, upper: true }), body], dim(s, s.gap * 0.6)), s, {
      ...(fill ? { fill } : {}),
      extra: kind === 'landscape' ? { grow: 1, shrink: 1, width: '0dp' } : {},
    });
  if (clean(f.short)) sections.push(section('Bedeutung', text(clean(f.short), dim(s, s.body))));
  if (clean(f.customs)) sections.push(section('Brauchtum', text(clean(f.customs), dim(s, s.body))));
  const impulses = (f.impulses ?? []).map(clean).filter(Boolean);
  if (impulses.length) {
    sections.push(
      section(
        'Impulse',
        column(
          impulses.map((i) => row([text('•', dim(s, s.body), { color: C.green }), text(i, dim(s, s.body), { grow: true })], dim(s, 1))),
          dim(s, s.gap * 0.6),
        ),
        C.greenTint,
      ),
    );
  }
  const body =
    kind === 'landscape' ? row(sections, gap, { alignItems: 'stretch' }) : column(sections, gap);
  const root = screenRoot([backChip(s), header, { type: 'ScrollView', grow: 1, shrink: 1, item: body }], s, dim(s, s.gap * 1.4));
  return { token: 'festivalScreen', document: document(root) };
}

// ---------- moon ----------

export function moonScreen(moon: Moon, kind: ViewportKind, garden?: MoonGarden): Screen {
  const s = SIZES[kind];
  const gap = dim(s, s.gap);
  const graphics: Record<string, unknown> = { moonToday: moonGraphic(moon.illumination, moon.waxing ?? (moon.phase_angle ?? 0) < 180) };
  for (const [phase, look] of Object.entries(QUARTER_LOOK)) graphics[`moon_${phase}`] = moonGraphic(look.lit, look.waxing, 48);

  const discSize = kind === 'portrait' ? 60 : kind === 'small' ? 70 : 52;
  const disc = { type: 'VectorGraphic', source: 'moonToday', width: dim(s, discSize), height: dim(s, discSize), scale: 'best-fit', align: 'center' };
  const pct = Math.round(moon.illumination * 100);
  const bar = row(
    [
      // Lit and dark part as two flex children: APL allows no percentage width inside an auto-sized parent.
      row(
        [
          { type: 'Frame', backgroundColor: C.brown, height: dim(s, 1.4), width: '0dp', grow: Math.max(pct, 1), borderRadius: dim(s, 0.8) },
          { type: 'Frame', backgroundColor: C.border, height: dim(s, 1.4), width: '0dp', grow: Math.max(100 - pct, 0), borderRadius: dim(s, 0.8) },
        ],
        '0dp',
        { grow: 1 },
      ),
      text(`${pct} % beleuchtet`, dim(s, s.small), { bold: true }),
    ],
    gap,
    { alignItems: 'center' },
  );
  const phases = (moon.upcoming ?? []).slice(0, kind === 'small' ? 3 : 4).map((q) =>
    row(
      [
        { type: 'VectorGraphic', source: `moon_${q.phase}`, width: dim(s, s.body * 1.3), height: dim(s, s.body * 1.3), scale: 'best-fit' },
        text(q.name, dim(s, s.body), { bold: true, grow: true, maxLines: 1 }),
        text(screenDate(q.date), dim(s, s.small), { color: C.muted, maxLines: 1 }),
      ],
      dim(s, s.gap),
      { alignItems: 'center' },
    ),
  );
  const gardenBox =
    garden && kind !== 'small'
      ? box(
          column(
            [
              text('Gärtnern mit dem Mond', dim(s, s.label), { bold: true, color: C.green, upper: true }),
              text(garden.rhythm?.text ?? (garden.speech ? clean(garden.speech) : ''), dim(s, s.body), { serif: true, bold: true }),
              ...garden.tips.slice(0, 2).map((t) => text(`• ${t.text}`, dim(s, s.small), { maxLines: 2 })),
              garden.note ? text(garden.note, dim(s, s.small * 0.9), { color: C.muted }) : null,
            ],
            dim(s, s.gap * 0.5),
          ),
          s,
          { fill: C.greenTint },
        )
      : null;
  const info = column(
    [
      column(
        [
          text('Mond heute', dim(s, s.label), { bold: true, color: C.muted, upper: true }),
          text(moon.name, dim(s, s.title * 1.2), { serif: true, bold: true, maxLines: 2 }),
          bar,
        ],
        dim(s, s.gap * 0.5),
      ),
      phases.length ? column([text('Nächste Phasen', dim(s, s.label), { bold: true, color: C.muted, upper: true }), ...phases], dim(s, s.gap * 0.7)) : null,
      gardenBox,
    ],
    dim(s, s.gap * 1.3),
    { grow: 1, shrink: 1 },
  );
  // „‹ Jahresrad“ first, above disc and details, so it sits top left as on every other screen.
  const root =
    kind === 'portrait'
      ? screenRoot([backChip(s), { ...disc, alignSelf: 'center' }, info], s, dim(s, s.gap * 2))
      : screenRoot([backChip(s), row([disc, info], dim(s, s.gap * 2.5), { alignItems: 'center', grow: 1, shrink: 1 })], s, dim(s, s.gap));
  return { token: 'moonScreen', document: document(root, graphics) };
}

// ---------- garden ----------

export interface TaskGroup {
  /** Shown above the group. */
  title?: string;
  /** Spoken before the group's first task. */
  intro?: string;
  tasks: Task[];
}

/** Which list a garden screen shows; a tapped task redraws the same one. */
export type GardenView = 'today' | 'week';

export function gardenScreen(
  opts: { view: GardenView; title: string; subtitle?: string; groups: TaskGroup[]; moon?: MoonGarden; highlight?: string },
  kind: ViewportKind,
): Screen {
  const s = SIZES[kind];
  const gap = dim(s, s.gap);
  const header = row(
    [
      column(
        [
          text('Im Garten', dim(s, s.label), { bold: true, color: C.green, upper: true }),
          text(opts.title, dim(s, s.title * 1.1), { serif: true, bold: true, maxLines: 1 }),
        ],
        dim(s, 0.4),
        { grow: 1, shrink: 1 },
      ),
      opts.subtitle ? text(opts.subtitle, dim(s, s.small), { color: C.muted, align: 'right', maxLines: 1 }) : null,
    ],
    gap,
    { alignItems: 'end' },
  );
  const items: Component[] = [];
  if (opts.moon?.tips.length) {
    items.push(
      box(
        column(
          [
            text('Gärtnern mit dem Mond', dim(s, s.label), { bold: true, color: C.green, upper: true }),
            text(clean(opts.moon.speech), dim(s, s.small)),
          ],
          dim(s, 0.6),
        ),
        s,
        { fill: C.greenTint, pad: s.cardPad * 0.7 },
      ),
    );
  }
  for (const group of opts.groups) {
    if (group.title) items.push(text(group.title, dim(s, s.small), { bold: true, color: C.autumn, maxLines: 1 }));
    for (const task of group.tasks) {
      const active = task.id === opts.highlight;
      items.push(
        box(
          row(
            [
              text('•', dim(s, s.body), { color: C.green }),
              text(task.title, dim(s, s.body), { grow: true, maxLines: 2 }),
              text('›', dim(s, s.body), { color: C.muted }),
            ],
            dim(s, s.gap),
            { alignItems: 'center' },
          ),
          s,
          {
            pad: s.cardPad * 0.6,
            ...(active ? { fill: C.greenTint, border: C.green } : {}),
            tap: { args: ['nav', 'task', task.id, opts.view], label: task.title },
          },
        ),
      );
    }
  }
  const list = { type: 'Sequence', grow: 1, shrink: 1, items: items.map((c, i) => (i === 0 ? c : { ...c, spacing: dim(s, s.gap * 0.6) })) };
  return { token: 'gardenScreen', document: document(screenRoot([backChip(s), header, list], s, gap)) };
}

// ---------- help ----------

export const HELP_CHIPS: { key: string; say: string }[] = [
  { key: 'today', say: 'Was gibt’s heute?' },
  { key: 'festival', say: 'Wann ist das nächste Fest?' },
  { key: 'imbolc', say: 'Erzähl mir von Imbolc' },
  { key: 'moon', say: 'Wie steht der Mond?' },
  { key: 'moonGarden', say: 'Was sagt der Mond zum Garten?' },
  { key: 'daylight', say: 'Wann geht die Sonne auf?' },
  { key: 'gardenToday', say: 'Was ist heute im Garten zu tun?' },
  { key: 'gardenWeek', say: 'Gartenarbeiten der Woche' },
];

export function helpScreen(kind: ViewportKind): Screen {
  const s = SIZES[kind];
  const gap = dim(s, s.gap);
  const chip = (c: { key: string; say: string }) =>
    tap(
      {
        type: 'Frame',
        backgroundColor: c.key.startsWith('garden') ? C.greenTint : C.card,
        borderColor: c.key.startsWith('garden') ? C.greenTint : C.border,
        borderWidth: '2dp',
        borderRadius: dim(s, 6),
        item: { ...text(`„${c.say}“`, dim(s, s.body), { maxLines: 1 }), paddingLeft: dim(s, 3), paddingRight: dim(s, 3), paddingTop: dim(s, 2), paddingBottom: dim(s, 2) },
      },
      ['nav', 'say', c.key],
      c.say,
      { grow: 1, shrink: 1, width: '0dp' },
    );
  const perRow = kind === 'portrait' ? 1 : 2;
  const rows: Component[] = [];
  for (let i = 0; i < HELP_CHIPS.length; i += perRow) rows.push(row(HELP_CHIPS.slice(i, i + perRow).map(chip), gap));
  const root = screenRoot(
    [
      backChip(s),
      column(
        [
          text('Frag das Jahresrad', dim(s, s.title * 1.2), { serif: true, bold: true }),
          text('Sag „Alexa, …“ und eine dieser Fragen, oder tippe einfach darauf.', dim(s, s.small), { color: C.muted }),
        ],
        dim(s, 0.6),
      ),
      { type: 'ScrollView', grow: 1, shrink: 1, item: column(rows, gap) },
    ],
    s,
    dim(s, s.gap * 1.5),
  );
  return { token: 'helpScreen', document: document(root) };
}

// ---------- error ----------

export function errorScreen(kind: ViewportKind, title: string, detail: string): Screen {
  const s = SIZES[kind];
  const root = screenRoot(
    [
      text(title, dim(s, s.title * 1.1), { serif: true, bold: true, align: 'center' }),
      text(detail, dim(s, s.body), { color: C.muted, align: 'center' }),
    ],
    s,
    dim(s, s.gap * 1.5),
    'column',
    { justifyContent: 'center', alignItems: 'center' },
  );
  return { token: 'errorScreen', document: document(root) };
}
