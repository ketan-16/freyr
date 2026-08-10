# Freyr — Design System

The visual and interaction spec for Freyr. This document is the **target**; `src/app.css` is its
implementation. Where the two disagree, this document wins and the CSS is wrong.

Token names below are the literal CSS custom properties — `--ink`, `--gain`, `--space-3`. There is no
translation layer between spec and code.

---

## Overview

Freyr is a **self-hosted personal ledger for daily power use**. Not a marketing site, not a trading
terminal — a tool its single user opens several times a day to type a number and read a table. Every
decision below serves one sentence: **more truthful information on screen, legibly, without noise.**

The atmosphere is **warm paper and deep evergreen**. The canvas is a slightly warm off-white
(`--canvas` #FBFAF8) rather than pure white — an accountant's ledger page, not a dashboard. Against
it sits a **deep evergreen rail** (`--rail-bg` #2C4A3B) carrying navigation. The brand green is dark
and desaturated on purpose: it reads as _furniture_, never as a value. That distinction is the
keystone of the whole system, because in a finance app green already means something — gain — and a
brand green that competes with a gain green makes every screen ambiguous.

The single accent is **lantern amber** (`--accent` #C1730E), lifted from the flame in the logo. It is
deliberately scarce. Amber marks exactly three things: the active navigation item, the keyboard focus
ring, and a value that needs attention (a budget nearing its limit). It is never decoration.

Money carries its own reserved pair — `--gain` and `--loss` — used as **text color only**, never as a
surface fill. A row is never painted green; a number is.

The product is **dual-theme, both first-class**. Unlike systems where dark mode is a marketing
surface and light mode is transactional, Freyr's two themes are the same app at the same density.
Theme resolves server-side from a cookie, so there is no flash of the wrong theme on first paint.

**Key characteristics**

- **One accent, three jobs.** `--accent` = active nav, focus ring, caution. Nothing else. Scarcity is
  what makes it legible.
- **Brand green never means "up."** `--brand` is chrome: rail, primary buttons, links. `--gain` is a
  brighter, more saturated green reserved for money. They are never interchangeable.
- **Density over comfort.** 28px table rows, 28px controls, a 4px spacing base. The whole point is
  fitting a month of transactions on one screen.
- **Flat, hairline-separated.** No shadows except on dialogs. Depth comes from a 1px hairline and a
  1.04:1 surface step, not elevation theatre.
- **One typeface, tabular numerals.** No custom fonts, no CDN, no font files. The system UI stack with
  `font-variant-numeric: tabular-nums` on every figure.
- **Radius stays small.** 3px controls, 4px cards, 6px dialogs. Nothing is a pill except badges.
- **Every color pair is contrast-verified.** Body text ≥ 4.5:1, UI boundaries and focus rings ≥ 3:1,
  in both themes, on all three background surfaces. Ratios are recorded per token below.

**Deliberate divergences from the Binance reference**

| Binance                                 | Freyr                                  | Why                                                                        |
| --------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Two custom typefaces (Nova + Plex)      | One system stack + `tabular-nums`      | Portability is a hard constraint — no font files, no CDN, no per-OS assets |
| Dark = marketing, light = transactional | Both themes are the same app           | Freyr has no marketing surface; theme is user preference, not page intent  |
| Yellow does all brand voltage           | Green does brand, amber does attention | A finance app cannot afford accent/semantic ambiguity in the green channel |
| 80px section rhythm                     | 16–24px section rhythm                 | Product-only, density-first; there are no editorial bands                  |
| Documents Default + Active only         | Also documents hover, focus, disabled  | Freyr is keyboard- and pointer-driven; hover and focus are load-bearing    |

---

## Brand & Logo

### The mark

Freyr is the Norse god of prosperity, harvest and fair weather. The mark is a **hooded, bearded figure
holding a lantern** — a steward who holds a light over your money. The lantern is the product thesis
made literal: _visibility into where it went_.

### What the source was

`logo.png` is the original artwork: a 472×838 RGBA raster, 257 KB, transparent background, drawn in
dark green with a cream lantern glass and an amber flame. It is a good mark drawn by hand, and the
refinement **preserves it** rather than replacing it. What it could not do was ship:

- **Raster only.** No vector source, so it softens on every HiDPI screen and at every size the app
  actually renders.
- **Edge noise.** Brush speckle along the contours and stroke weight that varies without intent — the
  silhouette reads as unfinished rather than carved.
- **Three colours.** The cream lantern glass is an opaque third fill, so the mark carries its own
  background and cannot sit cleanly on the evergreen rail.
- **A flame that isn't one.** At any threshold the amber region traces to a lobed blob with no tip;
  below ~48px it is an orange smudge.
- **257 KB** for a navigation-rail icon.

### What was done

The silhouette is **traced from the original artwork**, not redrawn. Pipeline: threshold the RGBA into
ink and amber masks → Gaussian-smooth each mask and re-threshold (this is what removes speckle and
relaxes the hand wobble without moving the real silhouette) → walk the iso-contours with marching
squares → simplify with Douglas–Peucker → re-smooth the polygons into closed Catmull-Rom cubics so the
result reads as _drawn_ rather than _traced_.

Settings are the chosen "balanced" grade: **blur σ 3.0, simplify ε 1.6**, yielding 12 contours. Lower
values keep more hand wobble; higher values straighten the hat into a true triangle and soften the
moustache. Balanced removes the artifacts and keeps the woodcut character.

Two deliberate departures from the source:

1. **The flame is redrawn.** It is the one element rebuilt by hand — a teardrop with a notched base,
   matching the source's character but legible at 24px. Tracing it faithfully produced a blob.
2. **The cream glass is dropped to knockout.** The lantern window now shows whatever is behind it. This
   is what reduces the mark to two colours and lets a single asset serve paper, rail and dark canvas.

Result: **one mark, 7.6 KB, `viewBox 0 0 200 464`** (1 : 2.32), silhouette on `currentColor`.

### Cuts and variants

There is **one cut**. The figure is the mark at every size — it is not reduced to the lantern alone for
small use, because the figure is the brand. Below ~24px it resolves to a hooded silhouette with an
amber spark, which is the correct behaviour for a favicon and is accepted rather than worked around.

| Asset                                 | Form                                     | Use                                                    |
| ------------------------------------- | ---------------------------------------- | ------------------------------------------------------ |
| `src/lib/components/FreyrMark.svelte` | Inline SVG, silhouette on `currentColor` | Rail brand, auth splash — inherits colour from context |
| `static/favicon.svg`                  | Explicit fills + `prefers-color-scheme`  | Browser tab; flips to paper-on-dark automatically      |

Because the silhouette is `currentColor`, the duotone / mono-dark / mono-light variants are not
separate files — they are whatever colour the parent sets. The flame is fixed and overridable only via
the `--flame` custom property, which exists for the auth splash and nothing else.

**Clear space:** one lantern-width on all four sides. Nothing crosses it.

**Wordmark lockup:** `FREYR` in the UI stack, weight 600, letter-spacing `0.16em`, optically centred
against the mark, separated by one lantern-width. Never in a serif, never italic, never with letters
recoloured individually.

**Misuse:** do not add a drop shadow or glow; do not rotate; do not place the mark on a mid-green
background where the silhouette loses contrast; do not recolour the flame; do not stretch to fit a
square — the mark is 1 : 2.32 and pads, never distorts.

---

## Colors

Every ratio below is measured, not estimated. Body text is held to **4.5:1**, non-text UI boundaries
and focus indicators to **3:1** (WCAG 2.2 SC 1.4.3 and 1.4.11), against _every_ surface the token can
legally sit on — `--surface`, `--canvas`, and `--sunk`. The figure quoted is the **worst case** of the
three.

### Surfaces

| Token           | Light     | Dark      | Use                                                                                                                                                               |
| --------------- | --------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--canvas`      | `#FBFAF8` | `#0E1411` | Page floor. Warm off-white / near-black with a green cast — never pure white, never pure black                                                                    |
| `--surface`     | `#FFFFFF` | `#151E19` | Cards, tables, the entry bar, dialogs                                                                                                                             |
| `--sunk`        | `#F3F1EC` | `#0F1713` | Table headers, inset wells, disabled fields                                                                                                                       |
| `--line`        | `#E3E0D9` | `#24312A` | Decorative hairlines — table dividers, section rules                                                                                                              |
| `--line-strong` | `#8D8A81` | `#5E7366` | **Control boundaries** — input, select and button edges. Held to 3:1 (worst case light 3.06, dark 3.35) because a control's edge is meaningful UI, not decoration |

Canvas-to-surface separation is deliberately slight — **1.04:1 light, 1.09:1 dark**. Cards are found by
their hairline, not by a brightness jump.

### Text

| Token         | Light     | Dark      | Worst-case ratio | Use                                                                           |
| ------------- | --------- | --------- | ---------------- | ----------------------------------------------------------------------------- |
| `--ink`       | `#14201A` | `#E6EDE8` | 14.87 / 14.33    | Default text, figures                                                         |
| `--ink-muted` | `#5C6862` | `#94A29A` | 5.15 / 6.41      | Labels, table headers, secondary meta. **Passes 4.5 — safe for real content** |
| `--ink-faint` | `#828C85` | `#6A7972` | 3.08 / 3.73      | Placeholder, disabled, decorative only. **Never body text**                   |

### Brand & accent

| Token           | Light     | Dark      | Worst-case ratio                  | Use                                                                                                               |
| --------------- | --------- | --------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--brand`       | `#2C4A3B` | `#64A181` | 8.65 / 5.65                       | Links, primary button fill, rail. Chrome — never a value                                                          |
| `--brand-hover` | `#223B2F` | `#78B394` | —                                 | Hover/press on brand fills                                                                                        |
| `--brand-tint`  | `#E9EFEA` | `#1A2A22` | 8.37 / 4.98 (brand on tint)       | Selected rows, quiet callouts                                                                                     |
| `--accent`      | `#C1730E` | `#E7A34A` | 3.25 / 7.90                       | **Fills, bars, rings, icons only.** In light mode this is a 3:1 non-text token — it may not be used for body text |
| `--accent-text` | `#8F540A` | `#E7A34A` | 5.41 / 7.90                       | The text-safe amber. Use whenever amber must be _read_                                                            |
| `--accent-tint` | `#FBF1E0` | `#2A2117` | 5.45 / 7.33 (accent-text on tint) | Caution callout backgrounds                                                                                       |

> **The one amber trap.** In light mode `--accent` (#C1730E) reaches only 3.67:1 on white. That clears
> the 3:1 bar for a focus ring or a progress bar, and fails the 4.5:1 bar for text. The system carries
> two amber tokens rather than compromising one: `--accent` for things you _see_, `--accent-text` for
> things you _read_. In dark mode both resolve to the same value.

### Money semantics

| Token    | Light     | Dark      | Worst-case ratio | Use                                    |
| -------- | --------- | --------- | ---------------- | -------------------------------------- |
| `--gain` | `#147E3B` | `#34C77B` | 4.56 / 7.80      | Income, positive delta, under budget   |
| `--loss` | `#BE2E29` | `#F0656B` | 5.15 / 5.50      | Overspend, negative delta, over budget |

Both are **text colors**. Neither may fill a row, a cell, or a card. A gain is a green _number_ on a
normal surface — this keeps a dense table readable and stops the eye from parsing color blocks as
groups.

`--gain` and `--brand` differ by roughly 25 points of lightness and a full step of saturation. That
gap is the system working; do not narrow it.

### Rail (chrome)

**The rail is a dark surface in both themes**, so it carries its own scoped token set rather than
inheriting the page ramp. This is why an amber indicator works there in light mode: it is amber on
dark green, not amber on paper.

| Token           | Light     | Dark      | Ratio vs `--rail-bg` | Use                                                           |
| --------------- | --------- | --------- | -------------------- | ------------------------------------------------------------- |
| `--rail-bg`     | `#2C4A3B` | `#16241D` | —                    | Rail fill                                                     |
| `--rail-fg`     | `#EAF0EC` | `#DCE6DF` | 8.45 / 12.60         | Nav labels                                                    |
| `--rail-muted`  | `#A6BEB0` | `#8CA396` | 4.94 / 5.98          | Section headings, the logout line                             |
| `--rail-accent` | `#E7A34A` | `#E7A34A` | 4.53 / 7.46          | Active-item indicator. **The dark-ramp amber in both themes** |
| `--rail-focus`  | `#FFFFFF` | `#E7A34A` | 9.77 / 7.46          | Focus ring inside the rail                                    |

In dark mode the rail sits only 1.16:1 from the canvas — intentionally. It is separated by a 1px
`--line` edge, not by brightness. Surface boundaries are decorative and carry no WCAG bar; control
boundaries do, and use `--line-strong`.

### State

| Token        | Light     | Dark      | Use                                                                  |
| ------------ | --------- | --------- | -------------------------------------------------------------------- |
| `--focus`    | `#C1730E` | `#E7A34A` | 2px focus ring, 1px offset. Scoped to `--rail-focus` inside the rail |
| `--hover`    | `#F3F1EC` | `#1B2620` | Row and item hover                                                   |
| `--selected` | `#E9EFEA` | `#1A2A22` | Selected row (= `--brand-tint`)                                      |

### Charts

Charts inherit the same discipline: money series use `--gain`/`--loss`; categorical series use an
evergreen-to-amber ramp so a chart never invents a color the rest of the app doesn't have.

`--c1` `--brand` · `--c2` `--accent` · `--c3` a desaturated teal · `--c4` a muted clay · `--c5`
`--ink-muted`. Five is the cap — beyond five categories, group into "Other". Never encode a category
in `--gain` or `--loss`; those two are reserved for direction.

---

## Typography

### Family

One stack, no downloads:

```
ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif
```

Binance splits editorial and numeric type across two custom faces. Freyr cannot — portable code with
zero binary assets is a stack-level constraint. The same discipline is achieved with
`font-variant-numeric: tabular-nums` applied to **every** numeric cell, so digits align in a column
exactly as a dedicated numeric face would. The rule survives; the font files don't.

### Root sizing

`html` stays at **`font-size: 100%`** and every size below is in `rem`.

> Freyr previously set `html { font-size: 14px }`. That hard-overrides the reader's browser font-size
> preference and is an accessibility defect, not a density technique. Density comes from the scale and
> the spacing, never from shrinking the root.

### Scale

| Token         | rem    | @16px | Weight | Line height | Tracking | Use                                                                      |
| ------------- | ------ | ----- | ------ | ----------- | -------- | ------------------------------------------------------------------------ |
| `--t-hero`    | 1.625  | 26px  | 600    | 1.15        | −0.01em  | The single headline figure on a screen — net worth, month total. Tabular |
| `--t-figure`  | 1.25   | 20px  | 600    | 1.2         | −0.005em | KPI tile values. Tabular                                                 |
| `--t-title`   | 1.0625 | 17px  | 600    | 1.3         | 0        | Page `h1`                                                                |
| `--t-section` | 0.8125 | 13px  | 600    | 1.3         | 0.06em   | `h2`, uppercase, `--ink-muted`                                           |
| `--t-body`    | 0.875  | 14px  | 400    | 1.45        | 0        | Default running text, table cells                                        |
| `--t-num`     | 0.875  | 14px  | 500    | 1.45        | 0        | Money in tables. Tabular, right-aligned                                  |
| `--t-control` | 0.8125 | 13px  | 400    | 1.2         | 0        | Inputs, selects, buttons                                                 |
| `--t-label`   | 0.75   | 12px  | 500    | 1.3         | 0.05em   | Field labels, `th`. Uppercase, `--ink-muted`                             |
| `--t-caption` | 0.6875 | 11px  | 400    | 1.3         | 0        | Timestamps, row meta, import markers                                     |

### Rules

- **Every figure is tabular.** Money, percentages, dates in numeric form, counts. No exceptions — a
  single proportional column breaks the scan.
- **Money is right-aligned. Labels are left-aligned.** Always. The decimal point is the alignment
  axis in a dense table.
- **Weight, not size, carries hierarchy.** The gap between `--t-body` and `--t-title` is 3px; the gap
  between 400 and 600 is what the eye actually reads. This is what keeps density without shouting.
- **Maximum two type sizes per component.** A KPI tile is `--t-label` + `--t-figure`. A table row is
  `--t-body` + `--t-num`. If a third size seems necessary, the component is doing too much.
- **No italics anywhere.** Not for emphasis, not for meta. Use `--ink-muted`.

---

## Layout

### Spacing

4px base. Names are multiples, so `--space-3` is unambiguously 12px.

| Token       | Value | Use                                                      |
| ----------- | ----- | -------------------------------------------------------- |
| `--space-0` | 2px   | Icon-to-label gap, badge padding                         |
| `--space-1` | 4px   | Cell padding (vertical), tight stacks                    |
| `--space-2` | 8px   | Cell padding (horizontal), control gaps, toolbar gaps    |
| `--space-3` | 12px  | Card padding, form field gaps                            |
| `--space-4` | 16px  | Main content padding, gap between cards                  |
| `--space-5` | 24px  | Gap between sections on a page                           |
| `--space-6` | 32px  | Page bottom padding                                      |
| `--space-7` | 48px  | Auth screen breathing room — the only place this appears |

Section rhythm is `--space-5` (24px), not Binance's 80px. Freyr has no editorial bands; a section here
is a table with a heading above it.

### Density

| Element                       | Height          | Notes                                                                |
| ----------------------------- | --------------- | -------------------------------------------------------------------- |
| Table row                     | 28px + hairline | 20px line box + `--space-1` top/bottom → 29px pitch                  |
| Table header                  | 28px + hairline | `--sunk`, sticky                                                     |
| Control (input/select/button) | 28px            | The system's baseline control height                                 |
| Row-level icon button         | 20px            | **Not** a control — a 28px button in a padded cell forces a 36px row |
| Rail item                     | 30px            | Slightly taller — it is a pointer and touch target                   |
| Mobile row / tab / icon       | 44px            | Touch minimum, applied below `40rem` only                            |

The 28px control height is what makes the ledger entry bar and the table it sits above read as one
instrument. Do not introduce a second control height for "comfortable" mode.

Cells set an explicit **`line-height: 20px`** rather than inheriting the unitless 1.45. Without it a
cell's line box drifts with its contents — a tag, an icon button or a nested `<form>` each contribute
baseline descender space — and rows stop landing on a common pitch. For the same reason, inline-block
content inside cells is `vertical-align: middle` and cell-level forms are `display: flex`. This is the
difference between a 29px row and a 37px one, which is four extra transactions on a laptop screen.

### Grid & container

- **Shell:** rail (fixed) + main (fluid). No right rail — Freyr's screens are one table wide.
- **Main max width:** `100rem` (1600px). Beyond that, tables get gutters rather than stretching; a
  2400px-wide transaction row is unreadable.
- **Forms:** capped at `36rem` when standalone (auth). The ledger entry bar is full-width by design —
  it is a toolbar, not a form.
- **Tables:** `width: 100%`, `table-layout: auto`. The amount column gets a `min-width` so it never
  collapses under a long note.

### Whitespace philosophy

Whitespace separates _sections_, never rows. Inside a table, separation is a 1px hairline and nothing
else. This is the opposite of a marketing layout and it is the correct call: the user is scanning for
one transaction among sixty, and every pixel of row padding is one fewer row on screen.

---

## Elevation & Depth

| Level    | Treatment                                                                                     | Use                                                        |
| -------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Flat     | No border, no shadow                                                                          | Page background, section headings                          |
| Hairline | 1px `--line`                                                                                  | Tables, cards, the entry bar, section rules                |
| Control  | 1px `--line-strong`                                                                           | Inputs, selects, secondary buttons — meaningful edges, 3:1 |
| Sunk     | `--sunk` fill                                                                                 | Table headers, disabled inputs, inset wells                |
| Raised   | 1px `--line` + `0 4px 12px rgb(0 0 0 / 0.10)` (light) / `0 4px 12px rgb(0 0 0 / 0.40)` (dark) | Dialogs and popovers **only**                              |
| Focus    | `outline: 2px solid --focus; outline-offset: 1px`                                             | Every interactive element                                  |

The philosophy is **flat surfaces, hairline separation**. No glassmorphism, no gradient surfaces, no
atmospheric backdrops, no colored shadows. The one shadow in the system exists to signal "this floats
above and traps your keyboard" — a real semantic, used nowhere else.

---

## Shapes

| Token      | Value  | Use                                          |
| ---------- | ------ | -------------------------------------------- |
| `--r-0`    | 0      | Table cells, sticky headers, full-bleed bars |
| `--r-1`    | 3px    | Inputs, selects, buttons, tags               |
| `--r-2`    | 4px    | Cards, the entry bar, notices                |
| `--r-3`    | 6px    | Dialogs, the auth card                       |
| `--r-full` | 9999px | Badges, avatars, the progress meter cap      |

Radius stays small deliberately. Large uniform rounding is the strongest single tell of generic
AI-generated UI, and it costs real estate at every corner. Nothing in Freyr is a pill except a status
badge.

### Iconography

**Lucide, inline SVG, 16px, 1.5px stroke, `currentColor`.** No icon font, no CDN, no sprite sheet.

- One set only — never mix Lucide with another family.
- Icons inherit text color; they are never independently colored except the rail's active indicator.
- Every icon-only control carries an `aria-label`.
- **No emoji as UI.** Ever.

Rail icons: `layout-dashboard` (Home) · `list` (Ledger) · `calendar` (Monthly) · `calendar-range`
(Yearly) · `sliders-horizontal` (Budget) · `sun`/`moon` (theme) · `log-out`.

---

## Components

Names below are CSS classes in `src/app.css` unless stated otherwise. There is no component library:
appearance is a class, and a `.svelte` file exists only where the same _markup_ repeats across pages.

### Svelte components

`src/lib/components/` holds the seven that earned their file. Each owns markup or a rule that more
than one page needs; none owns a color, and none re-derives a figure a page could get wrong.

**`Money.svelte`** — One `money-cell` value. Applies the sign and zero convention through
`formatCell` in `src/lib/format.ts`: zero is `—` in `--ink-faint`, an inflow is `+`-signed in
`--gain`, an outflow is bare. The cell keeps its own `class="num amount"`; this owns the value alone,
which is why the same figure reads identically on home, monthly, ledger and yearly.

**`Delta.svelte`** — One `delta-cell`, from `current`, `previous` and an optional `lowerIsBetter`.
Emits the arrow, the color class, the signed text and an optional trailing label. The arrow is
`aria-hidden` and absent when flat.

**`Meter.svelte`** — One `progress-meter` track, from the `Meter` value `src/lib/progress.ts`
returns. Renders the fill and, over the cap, the excess segment; renders `—` when there is no
allocation to measure against.

**`EntryBar.svelte`** — The whole `entry-bar` form, shared by `/ledger` and home so the two cannot
drift. Owns the direction-dependent fields (bucket/category/goal/location vs source), the
`use:enhance` handler that refocuses the amount field after a submit, and the form-level
`error-text`. It is a `<details open>` whose `<summary>` is hidden on desktop and becomes a 44px
disclosure below `40rem`, so a phone can put the table first without eight fields pushing it
off-screen.

**`Icon.svelte`** — The Lucide subset as inline path data, one `<svg>` at 16px and 1.5px stroke on
`currentColor`. The single gate on "one icon set, used consistently".

**`FreyrMark.svelte`** — The mark, silhouette on `currentColor`. See § Brand & Logo.

**`ThemeToggle.svelte`** — The `theme-toggle` form button.

Presentation _rules_ — which color class, which arrow, which width — live in the pure modules
`src/lib/format.ts` and `src/lib/progress.ts` rather than inside these components, because the test
setup has no component environment: a pure function is the only layer a test can reach. See
[ARCHITECTURE.md](ARCHITECTURE.md).

### Shell

**`app-shell`** — `display: grid; grid-template-columns: auto 1fr`. Rail plus main. Full viewport
height, main scrolls independently so the rail never leaves.

**`rail`** — `12rem` wide, `--rail-bg` fill, 1px `--line` right edge. Vertically: brand lockup,
primary nav, a section heading, secondary nav, a spacer, then the footer cluster (theme toggle +
logout). Uses the scoped rail token set throughout.

**`rail-item`** — 30px tall, `--space-2` horizontal padding, `--r-1`, 16px icon + `--t-body` label,
`--rail-fg`. Hover: 8% white overlay. **Active:** a 2px `--rail-accent` left bar, an 12% white
overlay, and weight 500. The amber bar is the only amber in the rail — it is how you know where you
are, and it is the single most-used accent in the app.

**`rail-brand`** — `mark-square` at 20px plus the `FREYR` wordmark in `--rail-fg`. Collapses to the
mark alone on the icon rail.

**`topbar`** — Present on mobile only (below `40rem`), 44px, `--surface`, hairline bottom edge.
Carries the current nav item's label and the theme toggle. On desktop the rail shows where you are
and no top bar exists. The label is a `<span>`, not a heading — the page keeps its own `<h1>`, and a
second `h1` would break the one-per-page landmark rule. See Known Gaps for the duplication this
costs.

**`tabbar-mobile`** — Fixed bottom bar below `40rem`. `--rail-bg`, five 44px tab targets, icon over
an 11px label. Active tab: `--rail-accent` icon and label plus a 2px top bar. Respects
`env(safe-area-inset-bottom)`.

**`theme-toggle`** — A form button posting to `?/theme`. Sun icon in dark mode, moon in light. Label
is `aria-label="Switch to light theme"` / `"Switch to dark theme"` — the icon shows the destination,
the label says it out loud.

### Data display

**`kpi-strip`** — `display: flex; gap: --space-3; flex-wrap: wrap`. The row of summary tiles at the
top of a screen. Wraps rather than scrolls.

**`kpi-tile`** — `--surface`, 1px `--line`, `--r-2`, `--space-3` padding, `min-width: 11rem`. Two
lines only: `--t-label` in `--ink-muted`, then `--t-figure` tabular in `--ink`. An optional third
element is a `delta-cell`. Never an icon — a big icon in a stat card is filler.

**`data-table`** — `--surface`, 1px `--line`, `--r-2`, `border-collapse: collapse`. `--t-body`.
Header row is `--sunk`, `--t-label`, uppercase, `position: sticky; top: 0`. Rows separated by 1px
`--line`; last row has none. Hover: `--hover`. This is the primary component of the entire
application — everything else exists to support it.

**`money-cell`** — `--t-num`, tabular, right-aligned, `white-space: nowrap`. Sign convention: outflows
render bare (`₹1,250.50`), inflows render with an explicit `+` in `--gain`. Zero renders as `—` in
`--ink-faint`, never as `₹0.00` — an em dash reads as "nothing here" far faster than a zero.

**`delta-cell`** — A signed change across three redundant channels — arrow, color and sign — so the
meaning survives color blindness and grayscale printing. **This redundancy is mandatory**; color is
never the sole carrier of meaning.

The arrow and the color are **independent, and answer different questions**:

| Channel | Reports                    | Rule                                                                      |
| ------- | -------------------------- | ------------------------------------------------------------------------- |
| Arrow   | Which way the number moved | `▲` when it rose, `▼` when it fell. Never inverted, on any figure         |
| Sign    | Which way the number moved | `+₹1,200` / `-₹1,200`, from `formatMoney`. Always agrees with the arrow   |
| Color   | Whether that is good news  | `--gain` when good, `--loss` when bad. `lowerIsBetter` inverts this alone |

So **a red `▲` is correct and expected.** Spending more is an upward movement and bad news at the
same time: the Spent tile on home, monthly and yearly passes `lowerIsBetter`, which flips the color
to `--loss` while the arrow keeps reporting that spending rose. An arrow that flipped with the color
would claim the figure fell, which is false. Do not "fix" this.

Flat (`current === previous`) is a single `—` in `--ink-faint` with **no arrow** — there is no
direction to point, and the arrow would only repeat the dash. The arrow is `aria-hidden`; the signed
text already says it out loud. An optional trailing label ("vs July") keeps `--ink-muted` in every
state, because it is prose a reader must read and `--ink-faint` is a 3:1 decorative token.

The rule lives in `delta()` in `src/lib/format.ts`, not in each call site.

**`bucket-tag`** — A small `--r-1` tag naming a bucket (needs / wants / investments). `--t-caption`,
uppercase, `--sunk` fill, `--ink-muted` text, 1px `--line`. Deliberately monochrome: buckets are
categories, not directions, and coloring them would spend the semantic budget that gain/loss needs.

**`progress-meter`** — An 8rem × 4px track, `--r-full`, `--sunk` fill, `overflow: hidden`. Below 80%
of allocation the fill is `--brand`; 80–100% it is `--accent`. Always paired with a text percentage,
beside it or in the next column — the bar is a glance, the number is the truth. No allocation to
measure against renders `—`, not an empty track.

**Over the cap the track rescales rather than overflowing.** The fill takes `100 ÷ pct` of the
track's width and an excess segment takes the rest, so the allocation and the overspend are both
visible _inside_ the fixed width and their ratio is the real one. Fill is `--loss`; the excess is the
same red at `opacity: 0.45`, split from the fill by a 1px `--surface` hairline so the 100% line is
drawn rather than implied. At 200% the bar reads as half plan, half overspend.

Nothing extends past the cap: a bar that grew beyond its track would either be clipped (an overspend
looking exactly like on-budget) or force the column to resize per row. The arithmetic is
`meter(actual, allocated)` in `src/lib/progress.ts` — one place, so a page cannot re-derive it wrong.

**`goal-row`** — Goal name, a `progress-meter`, saved / target as `money-cell`s, and a tabular
percentage. One line per goal.

**`month-stepper`** — `‹ June 2026 ›` with the current month in `--t-title` between two icon buttons.
Keyboard: left/right arrows step when the group has focus. The label is a real heading, not a
decoration.

**`filter-bar`** — A `GET` form of selects, `--space-2` gaps, wrapping. Auto-submits on change with a
`<noscript>` submit button as the fallback. No "Apply" button when JS is on.

**`sparkline`** — Inline 60×16 SVG, 1.5px `--brand` stroke, no axes, no fill. Trend only. Never
carries a tooltip; if a number matters enough to inspect, it belongs in a table.

**`empty-state`** — A single line of `--t-body` in `--ink-muted` inside the table body, spanning all
columns (`<td class="empty" colspan="N">`). Not an illustration, not a call to action. Below `40rem`
it takes the same one-card-per-row treatment as every other row and renders as one plain line with
**no** `data-label` pseudo-label — it is the table's content, not a field with a missing value, so
the reflow's hide-the-unlabelled rule carves it out by class.

### Forms

**`entry-bar`** — The inline transaction-add row on the ledger. `--surface`, 1px `--line`, `--r-2`,
`--space-2` padding, `display: flex; flex-wrap: wrap; align-items: end`. Fields size to content;
the note field takes remaining width. It sits directly above the table it feeds, so a new row appears
where the eye already is. Below `40rem` it stacks to full-width fields.

**`field`** — `--t-label` label above a control, `--space-0` gap. Labels are always present and always
visible; placeholder-as-label is not permitted.

**`input-text` / `select` / `input-date`** — 28px, `--space-1`/`--space-2` padding, 1px
`--line-strong`, `--r-1`, `--surface` fill, `--t-control`. Focus: 2px `--focus` outline, 1px offset.
Disabled: `--sunk` fill, `--ink-faint` text.

**`input-money`** — As `input-text` but right-aligned, tabular, `inputmode="decimal"`, `7rem` wide,
with a `₹` prefix in `--ink-muted`. Accepts grouped input (`1,250.50`); `src/lib/money.ts` owns
parsing.

**`button-primary`** — `--brand` fill, `--on-brand` text (white light / near-black dark), 28px, `--r-1`,
`--t-control` at weight 500. Hover `--brand-hover`. One per screen region.

**`button-secondary`** — `--surface` fill, 1px `--line-strong`, `--ink` text. Hover `--hover`.

**`button-ghost`** — No fill, no border, `--ink-muted`. For low-stakes inline actions.

**`button-danger-icon`** — A 16px `trash-2` in `--ink-faint`; hover `--loss`. Row-level delete.
`aria-label` required. Never a red-filled button in a table row — that would light up the whole
column.

**`notice`** — `--accent-tint` fill, 1px `--accent`, `--r-2`, `--space-2`/`--space-3` padding,
`--accent-text` text. For "no budget period covers this month". Informational, never celebratory.

**`error-text`** — `--t-body` in `--loss`, directly below the offending control, tied by
`aria-describedby`.

**A form-level error sits below the form's controls, after the submit** — feedback follows the
action. Two reasons it is not above: an `entry-bar` is a wrapping toolbar, so "above the submit" has
no stable position (the submit's row moves with the field count and the viewport); and DOM order
_is_ reading order, so a message that answers a submit belongs after the thing that was submitted.

It carries `role="alert"` in every case. `use:enhance` never reloads the page, so an unannounced
message is silent to a screen reader — the visible red line would be the only signal, which is
exactly the color-alone failure this system forbids. Where focus returns to a specific control after
the failure, that control points at the message with `aria-describedby`.

### Auth

**`auth-shell`** — `min-height: 100dvh`, grid-centered on `--canvas`. The one screen in Freyr that
gets `--space-7` of air.

**`auth-card`** — `--surface`, 1px `--line`, `--r-3`, `--space-5` padding, `19rem` wide. `mark-full`
at 56px above the heading. The only place the full figure appears in the app.

---

## Do's and Don'ts

### Do

- Reserve `--accent` for exactly three jobs: active nav, focus ring, caution threshold. Its power is
  its scarcity.
- Use `--gain` / `--loss` as **text color only**, and always alongside a sign or an arrow so meaning
  survives without color.
- Give every figure `tabular-nums` and right alignment. Every one.
- Keep `--brand` for chrome and interaction; keep `--gain` for money. A green button is brand green; a
  green number is gain green.
- Put the entry bar directly above the table it writes to.
- Render an empty money value as `—`, not `₹0.00`.
- Scope `--focus` to `--rail-focus` inside the rail — the page-level amber does not have enough
  contrast on evergreen.
- Let both themes carry the same density, the same components, and the same information.

### Don't

- Don't fill a row, cell, or card with `--gain` or `--loss`. Color blocks make a dense table
  unscannable and destroy the sign convention.
- Don't use `--accent` for body text in light mode — it reaches 3.67:1. Use `--accent-text`.
- Don't use `--ink-faint` for anything a user must read. It is a 3:1 decorative token.
- Don't set `html { font-size }` in pixels. It overrides the reader's browser preference.
- Don't add a second control height, a "comfortable" mode, or a density toggle. One density, chosen
  correctly.
- Don't introduce a third brand color. The system is evergreen and amber.
- Don't reach for shadows to create hierarchy — hairlines and the `--sunk` step already do it. The
  only shadow belongs to dialogs.
- Don't use emoji as icons, gradient surfaces, glassmorphism, or oversized uniform rounding.
- Don't center-align body content on ordinary screens. Auth is the only centered layout.
- Don't animate anything that isn't a state change under 150ms. No page transitions, no number
  count-ups, no skeleton shimmer.

---

## Responsive Behavior

Breakpoints are in `rem` so they scale with the reader's font size.

| Name    | Width                    | Shell                                                          | Tables                                                   | Notes                                                         |
| ------- | ------------------------ | -------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Mobile  | `< 40rem` (640px)        | Bottom `tabbar-mobile` + `topbar`; no rail                     | Reflow to stacked row cards                              | Controls and rows grow to 44px; `entry-bar` stacks full-width |
| Tablet  | `40–64rem` (640–1024px)  | Icon rail, `3.5rem`, labels hidden with `title` + `aria-label` | Full table, horizontally scrollable in its own container | KPI tiles 2-up                                                |
| Desktop | `64–90rem` (1024–1440px) | Full `12rem` rail with labels                                  | Full table, no scroll                                    | KPI tiles 3–4-up                                              |
| Wide    | `≥ 90rem` (1440px+)      | Full rail                                                      | Full table, main capped at `100rem`                      | Extra width becomes gutter, not column width                  |

### Table reflow below 40rem

The table does **not** become a horizontally-scrolling strip on phones — scanning a month of spending
sideways is useless. Each row becomes a card:

```
┌──────────────────────────────────┐
│ 12 Jun            −₹1,250.50     │   date left, amount right (--t-num)
│ Eating out · wants               │   category · bucket (--ink-muted)
│ dinner with S                    │   note, --t-caption, omitted if empty
└──────────────────────────────────┘
```

Implemented with a CSS-only reflow — the same `<table>` markup switches to
`display: block` with `data-label` pseudo-elements. Semantics and server rendering are untouched;
there is no second mobile template to keep in sync.

**`data-label` is the value's presence, not its name.** A cell whose value is absent omits the
attribute in the template and the reflow hides it, so a card shows only the fields that carry
information; a cell with `data-label=""` (the row action) is parked in the card's corner instead of
claiming a line. Two consequences worth stating, because both have already been shipped wrong: any
new cell that is not a labelled field — the `empty-state` line above all — needs its own carve-out or
it vanishes on phones; and a label must never be added merely to keep a cell visible, because that
prints an uppercase heading over a blank value.

### Touch

- Every target below `40rem` is ≥ 44×44px, including the row delete control.
- The bottom tab bar reserves `env(safe-area-inset-bottom)`.
- Hover styles are wrapped in `@media (hover: hover)` so touch devices don't get sticky hover states.

### Motion and preference queries

- `prefers-reduced-motion: reduce` → all transitions to `0.01ms`. The app is fully usable with zero
  animation; nothing conveys meaning through movement.
- `prefers-contrast: more` → `--line` resolves to `--line-strong`, focus ring widens to 3px.
- `prefers-color-scheme` sets the default theme; the cookie overrides it.

### Theming mechanism

1. `+layout.server.ts` reads the `freyr_theme` cookie (`light` | `dark` | absent).
2. The value is stamped as `data-theme` on `<html>` during SSR, so the correct theme is in the first
   byte — no flash, no inline blocking script.
3. Absent cookie → no attribute → `@media (prefers-color-scheme: dark)` decides.
4. The toggle is a **form action**, not client state. It sets the cookie and redirects back.
5. `color-scheme: light dark` is declared so native scrollbars, form controls, and the caret follow.

This fits the stack constraint exactly: no client-side state library, works without JavaScript, and
survives a hard refresh.

---

## Accessibility Baseline

Non-negotiable, verified rather than assumed:

- **Contrast:** text ≥ 4.5:1, UI boundaries and focus indicators ≥ 3:1, in both themes, against every
  surface the token can appear on. The ratios in the Colors section are the record.
- **Focus:** every interactive element has a visible 2px ring. `:focus-visible`, never `:focus`, so
  pointer users don't see rings — but the ring is never removed.
- **Color is never alone.** Sign, arrow, or text always accompanies `--gain`/`--loss`.
- **Keyboard:** full operation without a pointer. Rail is a `<nav>` with a real list; the month stepper
  responds to arrow keys; dialogs trap focus and close on `Escape`.
- **Labels:** every control has a visible `<label>`. Icon-only controls carry `aria-label`. Tables use
  real `<th scope>`.
- **Landmarks:** one `<nav>`, one `<main>`, one `<h1>` per page.
- **Zoom:** usable to 200% without horizontal scrolling, which is why the scale is in `rem` and the
  breakpoints are too.

---

## Iteration Guide

1. **One component at a time.** Reference it by name (`data-table`, `kpi-tile`) and change it
   everywhere at once — there is one stylesheet and no component library to drift from.
2. **New color? Almost certainly no.** The palette is closed at surfaces + text + brand/accent +
   gain/loss. If something needs a new color, first check whether it actually needs a new _component_.
3. **Verify contrast before committing a token.** Both themes, all three surfaces, worst case. A token
   that passes on `--surface` and fails on `--sunk` is a bug that will ship.
4. **Density is a budget.** Adding vertical padding anywhere spends screen real estate that belongs to
   rows. Justify it or don't.
5. **Both themes in the same commit.** A token added to `:root` without its `[data-theme='dark']`
   counterpart is an unfinished change.
6. **Check the keyboard path** for anything interactive, before calling it done.
7. **`npm run check`, `npm run lint`, `npm test`** must be clean — same bar as domain code.

---

## Known Gaps

- **Charts are specified but not built.** The `--c1`…`--c5` ramp and the sparkline spec exist; no
  charting code does yet. The ramp will need re-verification for contrast against both canvases once
  real charts land.
- **Dialogs are specified but not built.** Nothing in Freyr currently opens one; the `raised`
  elevation level and focus-trap rules are written ahead of first use.
- **The mark is a trace, not a redraw.** It faithfully preserves the original artwork's proportions,
  including its slight asymmetries. A designer redraw would tighten the brow shapes (the source's left
  and right brows differ) and the hood curvature — but that would be a new mark, not a refinement, and
  is deliberately out of scope.
- **No raster favicon fallback.** `favicon.svg` only. Every browser Freyr targets supports SVG
  favicons; a 32px PNG would need generating if that ever stops being true.
- **No transaction-edit surface exists yet** (rows are add/delete only), so inline-edit and
  optimistic-update patterns are undocumented.
- **The mobile top bar can repeat a page's name.** It carries the active nav label while the page
  keeps its own `<h1>`, so a page whose heading matches its nav label shows the name twice below
  `40rem` — `/settings/budget` reads "Budget" over "Budget"; `/ledger` reads "Ledger" over "Ledger".
  The alternatives are worse: promoting the bar to the `h1` costs the one-`h1`-per-page landmark and
  the page's own subtitle line, and dropping the bar leaves a phone with no persistent "where am I"
  (the rail is hidden and the tab bar is at the far end of the screen). Accepted until a page needs a
  heading that differs from its nav label for its own reasons.
- **Print styles are not addressed.** A year-end statement print sheet would need its own pass.
- **The categorical chart ramp is provisional** — `--c3` and `--c4` are named by intent rather than
  fixed hex, pending a real chart to tune against.
