# Freyr — Design System

The visual and interaction spec for Freyr. This document is the **target**; `src/app.css` is its
implementation and the components in `src/lib/components/` are its vocabulary. Where the code and
this document disagree, fix one of them in the same commit.

Token names below are the literal CSS custom properties — `--ink`, `--gain`, `--s-3`. There is no
translation layer between spec and code.

---

## Overview

Freyr is a **self-hosted ledger for daily power use**: a tool its single user opens several times
a day to type a number and read where the month stands. Every decision serves one sentence —
**more true information on screen, legibly, in fewer steps.**

The system is an instrument panel, not a brochure:

- **Colour carries data, never decoration.** Chrome is neutral ink on neutral surfaces. The three
  buckets own the only chart hues, `--gain`/`--loss` colour money text, and amber means "look
  here" — the focus ring and caution. Nothing else is coloured.
- **Dense, then legible.** 13px body, 30px table rows, 28px controls, a 4px spacing base. A month
  of transactions reads on one screen, and a dashboard fits above the fold at 1440×900.
- **Every screen answers first, then shows the evidence.** Home leads with what is left to spend,
  then the pace chart that explains it, then where the money went.
- **Charts are first-class and quiet.** Thin marks, hairline grids, labels in ink, a hover and
  keyboard layer on every plot, and a table beside every chart that carries the same figures.
- **Keyboard-first.** ⌘K jumps anywhere, `N` adds, `g`+letter navigates, `[` `]` step the period.
- **Progressive enhancement.** Every screen renders on the server and every write is a form
  action; script makes it instant (sheets, in-place refresh, filtering) but is never required.
- **Two themes, one app.** Light and dark carry the same density, components and information;
  the theme is a cookie resolved during SSR, so there is no flash.

**Deliberately not here** — the generic "AI dashboard" look: purple/violet gradients, emoji as
icons, glassmorphism, oversized uniform rounding, hero text centred on ordinary screens,
big-icon card grids, sparkle icons, skeleton shimmer, count-up numbers.

---

## Brand & logo

The mark is a **hooded, bearded figure holding a lantern** — Freyr, the Norse god of prosperity,
as a steward who holds a light over your money. It is traced from the original artwork in
`logo.png` (de-speckled, contours relaxed, stroke weight unified) with a hand-redrawn flame that
stays legible at sidebar size. One cut, `viewBox 0 0 200 464`, silhouette on `currentColor`, flame fixed
at `--flame` (`#E7A34A`).

| Asset                                 | Use                                                             |
| ------------------------------------- | --------------------------------------------------------------- |
| `src/lib/components/FreyrMark.svelte` | Sidebar (22px), auth cards (40px) — inherits ink from context   |
| `static/favicon.svg`                  | Browser tab; flips to light-on-dark with `prefers-color-scheme` |

**Wordmark:** `FREYR`, UI sans, weight 650, tracking `0.14em`, uppercase — the one place uppercase
appears. Never recolour the flame, never stretch the mark (it is 1 : 2.32 and pads), no shadow.

### Iconography

Lucide (`lucide-static` 0.544.0, ISC), inlined as path data in `Icon.svelte` — no icon font, no
sprite, no CDN. One set, a 1.75 stroke at 16px (2.25 on the add glyph), `currentColor`, always
`aria-hidden`; every icon-only control carries an `aria-label` and a `title`. Screens: `house`
Home, `arrow-left-right` Ledger, `chart-pie` Budget, `chart-column` Year, `sliders-horizontal`
Splits, `tags` Categories, `settings`. Never emoji, never a second set.

---

## Colour

Every text and boundary token below is measured with the WCAG formula against **every surface it
may sit on**; the figure given is the **worst case**. Body text ≥ 4.5:1, control boundaries and
focus ≥ 3:1. Re-measure before changing any token, in both themes.

### Surfaces

| Token           | Light     | Dark      | Use                                                       |
| --------------- | --------- | --------- | --------------------------------------------------------- |
| `--bg`          | `#F4F4F5` | `#09090B` | Sidebar, auth backdrop — the chrome one step behind       |
| `--surface`     | `#FFFFFF` | `#111113` | The main column, panels, popovers, dialogs                |
| `--sunk`        | `#F6F6F7` | `#18181B` | Wells: segmented track, entry bar, day headers on a phone |
| `--hover`       | `#F2F2F4` | `#18181B` | Row and item hover                                        |
| `--active`      | `#E9E9EC` | `#202024` | Current nav item, pressed icon button, selected menu item |
| `--line`        | `#E7E7EA` | `#222226` | Hairlines: table rows, panel borders                      |
| `--line-2`      | `#DCDCE0` | `#2C2C31` | Button and segmented borders, popover edges               |
| `--line-strong` | `#84848E` | `#68686F` | **Input and select boundaries** — 3.31 / 3.20 worst case  |

The main column is `--surface` and the sidebar `--bg`, so content leads and chrome recedes; a
panel is found by its hairline, not a shadow.

### Ink

| Token         | Light     | Dark      | Worst case    | Use                                                  |
| ------------- | --------- | --------- | ------------- | ---------------------------------------------------- |
| `--ink`       | `#09090B` | `#EDEDEF` | 16.42 / 13.89 | Text, figures, the primary button's fill             |
| `--ink-2`     | `#52525B` | `#A1A1AA` | 6.38 / 6.33   | Labels, secondary text, bucket names in rows         |
| `--ink-3`     | `#67676F` | `#8B8B95` | 5.01 / 5.25   | Meta, captions, axis labels, placeholders            |
| `--ink-faint` | `#A1A1AA` | `#52525B` | 2.56 / 2.44   | **Decorative only** — the em dash of an empty figure |
| `--on-ink`    | `#FFFFFF` | `#09090B` | 19.90 / 17.02 | Text on an ink fill (primary button, toast, chips)   |

### Money, caution and focus

| Token     | Light     | Dark      | Worst case  | Use                                                 |
| --------- | --------- | --------- | ----------- | --------------------------------------------------- |
| `--gain`  | `#08793D` | `#3ECF8E` | 4.93 / 8.88 | Income figures, a good delta — **text only**        |
| `--loss`  | `#C9272D` | `#FF6B6F` | 4.93 / 6.40 | Overspend, a bad delta, the excess on a bullet      |
| `--warn`  | `#9C5700` | `#F0A23A` | 5.10 / 8.02 | Caution text; on `--warn-bg` inside a `warn` notice |
| `--focus` | `#C2670A` | `#E5A03F` | 3.59 / 7.96 | The 2px focus ring, everywhere                      |

`--loss` on `--loss-bg` (the danger button's hover) is 4.82 / 6.22.

**Rules.** `--gain` and `--loss` colour a figure, never a row or a card; a figure that carries
them also carries a sign or an arrow, so colour is never the only channel. Amber has exactly two
jobs — focus and caution — and its scarcity is what makes it legible. Chrome (buttons, links,
selection) is ink, so no interface colour can be mistaken for a value.

### Data

The three buckets are **categorical identity** and keep one hue everywhere — legends, bars,
bullets, swatches beside a name:

| Token            | Light     | Dark      | Series                                             |
| ---------------- | --------- | --------- | -------------------------------------------------- |
| `--needs`        | `#2A78D6` | `#3987E5` | Needs                                              |
| `--wants`        | `#EB6834` | `#D95926` | Wants                                              |
| `--invest`       | `#1BAF7A` | `#199E70` | Investments                                        |
| `--muted-series` | `#B4B4BC` | `#4A4A52` | De-emphasis: last month, income beside spend, rest |
| `--grid`         | `#EFEFF1` | `#1C1C20` | Gridlines and weekend bands                        |

The set is validated with the dataviz method's validator (OKLab ΔE, Machado 2009 CVD simulation)
against Freyr's own surfaces, **all pairs**, both themes:

| Check               | Light                | Dark          |
| ------------------- | -------------------- | ------------- |
| Lightness band      | pass                 | pass          |
| Chroma floor        | pass                 | pass          |
| CVD separation      | worst ΔE 9.2 (≥ 8)   | worst ΔE 9.4  |
| Normal-vision floor | worst ΔE 24.0 (≥ 15) | worst ΔE 20.9 |
| Contrast vs surface | invest 2.82 — relief | all ≥ 3:1     |

Light `--invest` sits under 3:1, which the method allows only with a relief channel: every bucket
mark is directly labelled or has a table beside it. Income sources in the year view use two
neutrals (`.job` ink-2, `.side` muted) so no bucket hue is borrowed.

**Text never wears a series colour.** A bucket is named in ink or `--ink-2`, with a swatch beside
the word (`.bk`, `.sw`) carrying the hue.

---

## Typography

One stack, no font files: `ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, …` —
SF Pro on Apple, Segoe UI on Windows, Roboto on Android. The root stays at the browser's size
(`font-size: 100%`); everything is in `rem`, so a reader's preference scales the whole app.

| Token       | Size (px) | Use                                                    |
| ----------- | --------- | ------------------------------------------------------ |
| hero        | 42 / 34   | Home's one headline figure (`.hero-fig`; phone second) |
| `--t-hero`  | 32        | The error page's status                                |
| `--t-kpi`   | 20        | KPI values, a bucket card's spend                      |
| `--t-title` | 17        | Page `h1` in the page header (15 on a phone)           |
| `--t-lg`    | 15        | Sheet title, bucket card name, command input           |
| `--t-md`    | 13        | Body, table cells, controls, panel titles              |
| `--t-sm`    | 12        | Labels, meta, deltas, tooltips                         |
| `--t-xs`    | 11        | Axis ticks, tags, `kbd`                                |

- **Figures in a column are tabular** (`.num`, `.tnum`, every `table`, axis ticks); a lone
  headline figure keeps proportional digits, which read tighter at display size.
- **Money is right-aligned, names left-aligned.**
- **Hierarchy is size and weight, not case.** Labels are sentence case in `--ink-3`; the wordmark
  is the only uppercase.
- Negative tracking on large figures only (−0.03em hero, −0.015em KPI).

---

## Space, shape, depth

**Spacing** is a 4px base: `--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 20 · `--s-6`
24 · `--s-8` 32. Sections are `--s-4` apart (`--s-3` on a phone); whitespace separates sections,
never rows — inside a table, separation is a 1px hairline.

**Density**

| Element     | Fine pointer | Coarse pointer      | Token      |
| ----------- | ------------ | ------------------- | ---------- |
| Control     | 28px         | 36px                | `--h`      |
| Table row   | 30px         | 40px                | `--row`    |
| Page header | 52px         | 48px on phones      | `--ph-h`   |
| Sidebar     | 13rem        | 3.5rem rail ≤ 64rem | `--side-w` |

On a coarse pointer every field's text is 16px, so focusing one never zooms the page.

**Radius:** `--r-sm` 4 (tags, kbd, segments) · `--r` 6 (controls) · `--r-lg` 8 (panels, popovers,
notices) · `--r-xl` 12 (dialogs, auth card; 16 at the top of the phone sheet). Round, never
bubbly.

**Depth:** hairlines do the work. Panels have a border and no shadow. `--shadow-sm` seats a
button, the selected segment and the search box; `--shadow-pop` belongs to what floats — dialogs,
the month picker, tooltips, toasts. No glass, no gradients, no coloured shadows.

---

## Layout

**Shell.** A sticky sidebar (`--bg`) beside the main column (`--surface`). The document scrolls,
not an inner container, so scroll restoration, find-in-page and mobile browser chrome behave
natively. A 2px ink hairline at the top of the viewport fills while a navigation loads; the old
page stays in place underneath — no skeletons.

**Sidebar** (`.side`): brand; _Jump to…_ (opens the command menu, `⌘K`); _New transaction_
(`N`); the four screens — Home, Ledger, Budget, Year; a Settings group — Splits, Categories; and
a foot with the account initial (a link to Settings), the theme toggle and log out. The current
item is `--active` with ink text. At ≤ 64rem it is a 3.5rem icon rail with titles.

**Page header** (`PageHeader.svelte`, `.ph`): sticky, 52px, `h1` plus a context line (the period
or count it shows), then the screen's own controls on the right — the month stepper, the year
stepper. Every screen opens the same way, so the control corner is learnt once.

**Page** (`.page`): max 90rem, 24px gutters (20 on a tablet, 14 on a phone), and an inline-size
container. The **grid** (`.grid`) is 12 columns with `.c5`, `.c6`, `.c7` spans; container queries
collapse them to full width below 64rem of _content_ width and every panel below 44rem, so the
layout follows the space it actually has, sidebar or not.

**Panel** (`.panel`): border, 8px radius, `overflow: clip` (not hidden — a hidden overflow is a
scroll container and would break the sticky table head). A `.panel-h` holds an `h2`, then meta or
a link onward (`.more`); `.panel-b` pads content, `.panel-f` is a ruled footer line.

**KPI strip** (`.kpis` of `Kpi.svelte`): one card divided by 1px gaps over a `--line` floor, so the
dividers are drawn at any wrap count. Label, value, and a foot line (a delta or its context), with
an optional six-month sparkline beside the value.

---

## Components

| Vocabulary       | Code                                                            |
| ---------------- | --------------------------------------------------------------- |
| page-header      | `PageHeader.svelte` — `.ph`, `.ph-title`, `.ph-actions`         |
| stepper          | `Stepper.svelte` — `.stepper`; `MonthNav.svelte` adds a picker  |
| month picker     | `.picker` popover, `.picker-grid`                               |
| panel            | `.panel`, `.panel-h`, `.panel-b`, `.panel-f`, `.panel-note`     |
| kpi              | `Kpi.svelte` in `.kpis`                                         |
| hero             | `.hero`, `.hero-fig`, `.facts` (home)                           |
| bullet           | `Bullet.svelte` — `.bullet` with `.fill`, `.over`, `.mark`      |
| share bar        | `ShareBar.svelte` — `.share-bar`                                |
| ranks            | `Ranks.svelte` — `table.ranks`                                  |
| sparkline        | `Sparkline.svelte` — `svg.spark`                                |
| money            | `Money.svelte`                                                  |
| delta            | `Delta.svelte` — `.delta` (`.pos` / `.neg` / `.flat`)           |
| bucket label     | `.bk` + bucket class; `.sw` is the bare swatch                  |
| tag              | `.tag` (`.strong` for "in force")                               |
| table            | `table.tbl` (`.num`, `.grow`, `.first`, `.last`, `tr.current`)  |
| statement        | `table.t-txn` with one `tbody.day` per day                      |
| entry bar        | `EntryBar.svelte` — `.entry-wrap`, `.entry`                     |
| transaction form | `TxnForm.svelte` — `.txn-form`, `.amount-field`, `.chips`       |
| sheet            | `TxnSheet.svelte` — `dialog.sheet`                              |
| command menu     | `CommandMenu.svelte` — `dialog.cmd`                             |
| toasts           | `.toasts` / `.toast` in the layout                              |
| notice           | `Notice.svelte` — `.notice.info` / `.notice.warn`               |
| buttons          | `.btn` (`.primary`, `.ghost`, `.danger`, `.block`), `.icon-btn` |
| segmented        | `.seg` — radios, or links with `aria-current` for a filter      |
| fields           | `.field`, `.label`, `.affix` (`.pre` ₹ / `.post` %)             |

### Figures

- **Money** (`Money.svelte`, rules in `format.ts`): zero is an em dash in `--ink-faint`, an
  inflow is `+`-signed in `--gain`, an outflow bare. `compact` prints ₹1.2L with the exact figure
  in the title.
- **Compact figures** (`formatCompact`): Indian units — ₹950, ₹9.5K, ₹95K, ₹9.5L, ₹1.5Cr — one
  decimal, promoted when a value rounds up into the next unit (99,960 is ₹1L). Axes and chart
  labels only; tables print exact figures.
- **Delta** (`Delta.svelte`, rules in `delta()`): arrow, sign and colour. The arrow reports which
  way the number moved; the colour whether that is good (`lowerIsBetter` inverts colour only). A
  red ▲ on spending is correct. Flat is a single em dash. The figure never wraps; its caption may.
- **Share** (`share()`): whole percent, `<1%` for a sliver, em dash for an empty whole.

### Bullet

Spend against an allocation, from `meter()` in `progress.ts`. The track is the bar's own hue at
16%; under the cap one fill, over it the track rescales so plan and excess both fit, the excess in
`--loss` after a 2px gap. An ink tick (`mark`) shows how much of the period has gone: a fill past
it is spending ahead of the calendar. Tones: **bucket** (the bucket's hue), **severity** (neutral
→ `--warn` at 80% → `--loss` over; home's month bar), **neutral** (goals, clamped at the target —
a goal past its target is done, not overspent). Always beside a figure.

### Tables

`table.tbl`: 30px rows, hairlines, a sticky 32px head that parks under the page header, hover in
`--hover`, figures right-aligned and tabular. `.grow` hands the slack to one column (a note, a
name) so figures stay together at the right edge. A table in `.tbl-scroll` scrolls sideways on a
phone with its head pinned inside the scroller.

**Statement** (`t-txn`, the ledger): one `tbody` per day with a header row — `Wed 30 Sep` and the
day's totals — then its rows in statement order: category, note (the slack), bucket, amount.
The whole row opens the edit sheet; the category is a real link (`/ledger/:id`) so the keyboard,
a middle-click and script-off all work.

### Forms

- **Transaction form** (`TxnForm.svelte`): direction (segmented, with arrow icons), **amount** (a
  26px field, the one that takes focus), bucket or source (segmented, with swatches), category
  (**chips** — every option visible, one tap), then date and note. The category list is the
  answer's own scope; an edited row keeps an archived category it was filed under. Rows linked
  to a goal stay outflows and repayments stay income (the radios are disabled and the server
  refuses the change); an `other`-source repayment opens read-only with delete.
- **Entry bar** (`EntryBar.svelte`, the ledger): the same answers as one 28px toolbar row above
  the table, selects instead of chips; after each add the amount field takes focus again.
- **Script off**, both forms offer every category grouped by what it belongs to — script narrows
  the list as the bucket changes, and the server refuses a mismatched pair either way.
- **Errors** sit under the form's controls with `role="alert"`, tied to the amount field by
  `aria-describedby`. Failures never become toasts.
- **Delete** is two presses in the sheet (Delete → Confirm delete, disarming after 4s); with
  script off it is one submit on a dedicated page.

### Sheet, menu, toasts

- **Sheet** (`TxnSheet.svelte`): a native modal `<dialog>` — focus trapped, `Esc` closes, the
  backdrop click closes. A 30rem centred dialog on a desktop, a bottom sheet on a phone. Opened
  from the sidebar, the phone's add tab, `N`, the command menu and any transaction row. A
  successful post refreshes the page underneath in place (`invalidateAll`) and never navigates;
  the next add starts from the last one's answers. While a save is in flight the sheet holds: a
  second submit is dropped and it cannot be dismissed, so an entry is never posted twice or lost.
  Only a press that starts on the backdrop closes it — a text selection dragged out of a field
  does not.
- **Command menu** (`CommandMenu.svelte`): `⌘K`. Screens with their `g` shortcuts, actions (new
  transaction, switch theme, log out), and — once you type — the last twelve months of Budget and
  Ledger and the last three years. `↑ ↓` move, `↵` runs. It navigates; it never fetches.
- **Toasts**: ink, bottom right (above the tab bar on a phone), 4s, `role="status"` — a
  confirmation that something saved.

---

## Charts

One chart language across the app, built so the server renders the final picture:

- **Geometry is percentages of the plot.** Bars, dots and every label are HTML positioned in %;
  lines are SVG in a `0 0 100 100` viewBox with `preserveAspectRatio="none"` and a non-scaling
  2px stroke. Nothing is measured, so a chart fits any width with no layout shift, and corners
  and text never stretch. The helpers are pure (`src/lib/chart.ts`: `niceScale`, `pct`,
  `cumulative`, `linePath`, `areaPath`) and tested.
- **Axes:** a 2.75rem left gutter holds tabular value labels (`formatCompact`) centred on their
  gridline; ticks land on 1, 2, 2.5 or 5 × 10ⁿ. Gridlines are 1px `--grid`, the baseline
  `--line-2`. One axis, always — income and spend share a scale rather than two.
- **Marks:** columns ≤ 24px wide with a 3px rounded data end and a square baseline, stacked
  segments split by 2px surface gaps; lines 2px; the ink series gets an 8% area wash; reference
  lines are 1px dashed; dots are 10px with a 2px surface ring.
- **Hover and focus:** columns are links or hit targets wider than their bars; the line chart has
  a crosshair that snaps to the day and reads with `←` `→` once focused. One tooltip lists every
  series at that point, values leading, keys as short strokes or swatches; it flips side past
  the middle.
- **Every chart has its table view** on the same screen: the hero and KPIs for the pace chart, the
  bucket cards for the daily chart, _Month by month_ for the year chart, the periods table for the
  split chart.

| Chart        | Where              | Form                                                                                                                                                 |
| ------------ | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PaceChart`  | Home               | Running spend this month (ink + wash) vs last month (muted), with the allocation as a ceiling and the even pace to it dashed; today's point labelled |
| `DailyChart` | Budget, Ledger     | Day by day, stacked by bucket, weekends banded; `compact` drops the axis for the ledger's strip, whose columns jump to that day                      |
| `MonthChart` | Year               | Twelve months: income (muted) beside spend stacked by bucket; months link to their budget                                                            |
| `SplitChart` | Splits             | Each budget period as a band split into the three shares, raises marked on top, today as an ink line                                                 |
| `Sparkline`  | KPIs, bucket cards | Six months, the series' own range, no axes; hidden when there is no history                                                                          |
| `Ranks`      | Home, Budget, Year | Categories largest first with a bar in the bucket hue; the tail folds into "N more"                                                                  |

An empty chart says so in a sentence rather than drawing an axis of zeros.

---

## Interaction

| Key                    | Does                                                   |
| ---------------------- | ------------------------------------------------------ |
| `⌘K` / `Ctrl K`        | Command menu (from anywhere, even in a field)          |
| `N`                    | New transaction                                        |
| `/`                    | Filter the ledger; elsewhere, the command menu         |
| `G` then `H L B Y S C` | Home, Ledger, Budget, Year, Splits, Categories         |
| `[` `]`                | Previous / next month or year where a stepper is shown |
| `←` `→`                | Step the pace chart's crosshair once it has focus      |
| `↵`                    | Submit the sheet                                       |
| `Esc`                  | Close the sheet, the menu or the picker                |

Single-key shortcuts never fire while a field has focus or a dialog is open. **Script off**, every screen
still renders and every write still works: the add controls are links to the ledger's entry bar
(`/ledger#new`), a row is a link to its edit page, the month picker is a native popover of links,
filters are links, and the theme toggle is a form.

**Motion** is feedback only, ≤ 200ms: the sheet rises (fades on a desktop), the picker and toasts
fade in, hovers ease. `prefers-reduced-motion` removes all of it.

---

## Responsive behaviour

| Width           | Shell                                                  | Content                                                                        |
| --------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| > 64rem         | 13rem sidebar                                          | 12-column grid, panels side by side                                            |
| 40–64rem        | 3.5rem icon rail                                       | Panels full width; KPI strip still one card                                    |
| < 40rem (phone) | Five-slot tab bar: Home, Ledger, **add**, Budget, Year | The page header is the app bar (gear or back link); controls take a second row |

On a phone: the ledger is a two-line list (what and how much; then bucket and note) under
sunk day headers; Recent on home is the same shape; KPIs go two to a row without sparklines;
bucket rows put the bar on its own line; the sheet is a bottom sheet over the tab bar; the entry
bar only appears when linked to or after a failed submit. Wide tables (plan vs actual, month by
month, periods) scroll sideways inside their panel. The tab bar reserves
`env(safe-area-inset-bottom)`.

---

## Accessibility baseline

- **Contrast** as tabled above: text ≥ 4.5:1, boundaries and focus ≥ 3:1, worst case, both themes.
- **Focus:** a 2px `--focus` ring on `:focus-visible` everywhere, including chart columns, chips
  and segments (drawn on the visible part of a real radio).
- **Colour is never alone:** deltas carry arrow and sign; buckets carry a name beside the swatch;
  overspend carries a minus and the word "over".
- **Semantics:** one `h1` per screen; real tables with `th scope`; radios for every choice;
  `role="radiogroup"` with a label for each segmented control and chip set; native `<dialog>` for
  the sheet and menu; charts are labelled images or labelled groups with a summary sentence.
- **Zoom and text size:** everything in `rem`; usable at 200% without horizontal page scroll.
- **Forced colours:** chart marks opt out of forced-colour repainting so the bars survive.

---

## Do / Don't

**Do** keep colour for data and state; name a bucket beside its swatch; right-align figures in
tabular digits; render an empty figure as `—`; put the add form where its row appears; give every
chart a table on the same screen; measure a token before shipping it.

**Don't** fill a row or card with `--gain`/`--loss`; use `--ink-faint` for anything to be read;
colour text with a series hue; add a second value axis; add a colour when a component is what is
missing; animate anything that is not feedback; add a font file, an icon font or a second icon
set (Lucide only, inline, `currentColor`).

---

## Known gaps

- **Charts are hover- and focus-readable, not screen-reader-navigable point by point.** Each has
  a summary label and a table twin on the same screen; a per-point list is not built.
- **The categorical palette is capped at three series** (the buckets). A fourth series must fold
  into "Other" or facet, per the palette's validation.
- **No undo.** A delete is guarded by a two-step confirm, not reversible afterwards.
- **Print styles** only hide chrome; a year-end statement sheet would need its own pass.
- **The mark is a trace, not a redraw** — faithful to the source artwork, asymmetries included.
