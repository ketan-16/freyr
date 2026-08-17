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

The atmosphere is **cool neutral paper and near-black evergreen**. The canvas is a light neutral
grey (`--canvas` #F7F8FA) with white cards on it; the rail is a near-black with a green cast
(`--rail-bg` #14201B). The brand green is deep and slightly teal-leaning: it reads as _furniture_,
never as a value. That distinction is the keystone of the whole system, because in a finance app
green already means something — gain — and a brand green that competes with a gain green makes
every screen ambiguous.

> **Superseded: the warm-paper ramp.** Until 2026-08-17 the surfaces were warm — `--canvas`
> #FBFAF8, `--sunk` #F3F1EC, `--line` #E3E0D9 — argued for as an accountant's ledger page. On
> screen it did not read as warm, it read as _aged_: beige-on-beige against a desaturated forest
> green is the loudest period signal a UI can carry, and it dated the whole product. The neutrals
> above replace it. The evergreen brand and the lantern amber are kept; the paper is not.

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
- **Density over comfort, with room to read.** 32px table rows, 32px controls, a 4px spacing base.
  Still a month of transactions on one screen — but 28px rows with 4px of padding read as cramped,
  and cramped is half of what made the old screens feel lifeless.
- **Hierarchy is size and weight, never case.** No uppercase tracked micro-labels. They were doing
  the work at three levels at once — section head, table header, tile label — which is precisely
  why nothing outranked anything else and every screen read as one field of small grey text.
- **Hairlines first, one shadow for cards.** `--shadow-card` is two nearly-transparent stacked
  shadows that seat a card on the canvas; `--shadow-raised` belongs to dialogs. That is the entire
  depth budget. No glassmorphism, no gradient surfaces, no coloured shadows.
- **One typeface, tabular numerals.** No custom fonts, no CDN, no font files. The system UI stack with
  `font-variant-numeric: tabular-nums` on every figure.
- **Radius is soft, not round.** 6px controls, 8px cards, 12px dialogs, full-round only on tags and
  the meter. Large uniform rounding is still the strongest tell of generic AI-generated UI; 3px
  corners were the opposite failure and read as 2011 chrome.
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

**How to tell when this document is going stale.** The failure mode is not a wrong hex value, it is
a system that keeps every rule it wrote down and stops looking current anyway. The 2026-08-17 pass
was prompted by exactly that: the layout had just been rebuilt and the screens still read as a 2011
admin panel, because the daters were in the tokens — beige surfaces, a four-size type ramp with no
gaps in it, 3px radii, uppercase tracked labels on six components, and no elevation at all. None of
those violated a rule here; several were rules here. If the app looks dated, suspect this document
before suspecting its implementation.

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
| `--canvas`      | `#F7F8FA` | `#0D1117` | Page floor. Cool light grey / cool near-black — never pure white, never pure black                                                                                |
| `--surface`     | `#FFFFFF` | `#151B23` | Cards, tables, the entry bar, dialogs                                                                                                                             |
| `--sunk`        | `#EFF1F4` | `#11171E` | Table headers, inset wells, disabled fields                                                                                                                       |
| `--line`        | `#E2E5EA` | `#262E38` | Decorative hairlines — table dividers, section rules                                                                                                              |
| `--line-strong` | `#7E8691` | `#5C6773` | **Control boundaries** — input, select and button edges. Held to 3:1 (worst case light 3.25, dark 3.00) because a control's edge is meaningful UI, not decoration |

Canvas-to-surface separation is **1.06:1 light, 1.09:1 dark** — slight, but now doing real work: a
card is found by the step _and_ its hairline _and_ `--shadow-card`, which is what lets a panel
outrank the table inside it without any of the three shouting.

### Text

| Token         | Light     | Dark      | Worst-case ratio | Use                                                                           |
| ------------- | --------- | --------- | ---------------- | ----------------------------------------------------------------------------- |
| `--ink`       | `#0F1419` | `#E6EAF0` | 16.36 / 14.34    | Default text, figures                                                         |
| `--ink-muted` | `#5A626C` | `#9AA4B2` | 5.46 / 6.87      | Labels, table headers, secondary meta. **Passes 4.5 — safe for real content** |
| `--ink-faint` | `#767E89` | `#6E7885` | 3.63 / 3.87      | Placeholder, disabled, decorative only. **Never body text**                   |

### Brand & accent

| Token           | Light     | Dark      | Worst-case ratio                  | Use                                                                                                               |
| --------------- | --------- | --------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `--brand`       | `#0B6248` | `#3FB98A` | 6.50 / 7.02                       | Links, primary button fill, meter fill, rail. Chrome — never a value                                              |
| `--brand-hover` | `#084E39` | `#55C99B` | —                                 | Hover/press on brand fills                                                                                        |
| `--brand-tint`  | `#E2F1EA` | `#14312A` | 6.31 / 5.67 (brand on tint)       | Selected rows, quiet callouts                                                                                     |
| `--accent`      | `#C2670A` | `#E5A03F` | 3.54 / 7.78                       | **Fills, bars, rings, icons only.** In light mode this is a 3:1 non-text token — it may not be used for body text |
| `--accent-text` | `#97520A` | `#E5A03F` | 5.26 / 7.16                       | The text-safe amber. Use whenever amber must be _read_                                                            |
| `--accent-tint` | `#FDF1E1` | `#2A2016` | 5.34 / 7.16 (accent-text on tint) | Caution callout backgrounds                                                                                       |

> **The one amber trap.** In light mode `--accent` reaches 4.01:1 on white but only 3.54:1 on
> `--sunk`. That clears the 3:1 bar for a focus ring or a progress bar and fails the 4.5:1 bar for
> text. The system carries two amber tokens rather than compromising one: `--accent` for things you
> _see_, `--accent-text` for things you _read_. In dark mode both resolve to the same value.

### Money semantics

| Token    | Light     | Dark      | Worst-case ratio | Use                                    |
| -------- | --------- | --------- | ---------------- | -------------------------------------- |
| `--gain` | `#0E7A3C` | `#3DD68C` | 4.80 / 9.23      | Income, positive delta, under budget   |
| `--loss` | `#C02A2A` | `#F0656B` | 5.15 / 5.59      | Overspend, negative delta, over budget |

Both are **text colors**. Neither may fill a row, a cell, or a card. A gain is a green _number_ on a
normal surface — this keeps a dense table readable and stops the eye from parsing color blocks as
groups.

**`--brand` and `--gain` are separated on two axes, and both are load-bearing.** They sit
**1.35:1 apart in luminance (light) / 1.31:1 (dark)**, and `--brand` is measurably more teal while
`--gain` is a purer green. The pair has to survive the worst case in the app: yearly's _By month_
table puts brand-coloured month links in one column and gain-coloured income figures in the next.
Brightening the brand so it "shows up more" is the obvious way to break this — it was considered
and rejected for exactly that reason. Verify both axes before touching either token.

### Rail (chrome)

**The rail is a dark surface in both themes**, so it carries its own scoped token set rather than
inheriting the page ramp. This is why an amber indicator works there in light mode: it is amber on
dark green, not amber on paper.

| Token           | Light     | Dark      | Ratio vs `--rail-bg` | Use                                                           |
| --------------- | --------- | --------- | -------------------- | ------------------------------------------------------------- |
| `--rail-bg`     | `#14201B` | `#0F1613` | —                    | Rail fill                                                     |
| `--rail-fg`     | `#E8EDEA` | `#E3EAE6` | 14.16 / 15.01        | Nav labels                                                    |
| `--rail-muted`  | `#9BA8A1` | `#93A29B` | 6.80 / 6.89          | Section headings, the logout line                             |
| `--rail-accent` | `#F0A94C` | `#F0A94C` | 8.37 / 9.16          | Active-item indicator. **The dark-ramp amber in both themes** |
| `--rail-focus`  | `#FFFFFF` | `#F0A94C` | 16.77 / 9.16         | Focus ring inside the rail                                    |

The rail is a **near-black with a green cast** in both themes, not the mid-green it used to be in
light mode. A mid-tone coloured sidebar is a period tell of its own; a near-black one is what makes
the neutral canvas beside it read as bright and current. The evergreen is still there — it is the
cast in the black, and the mark on top of it.

### State

| Token        | Light     | Dark      | Use                                                                  |
| ------------ | --------- | --------- | -------------------------------------------------------------------- |
| `--focus`    | `#C2670A` | `#E5A03F` | 2px focus ring, 1px offset. Scoped to `--rail-focus` inside the rail |
| `--hover`    | `#F1F3F5` | `#1B222B` | Row and item hover                                                   |
| `--selected` | `#E2F1EA` | `#14312A` | Selected row (= `--brand-tint`)                                      |

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
| `--t-hero`    | 1.75   | 28px  | 680    | 1.15        | −0.025em | The single headline figure on a screen — net worth, month total. Tabular |
| `--t-figure`  | 1.375  | 22px  | 650    | 1.2         | −0.015em | KPI tile values. Tabular                                                 |
| `--t-title`   | 1.25   | 20px  | 650    | 1.3         | −0.01em  | Page `h1`                                                                |
| `--t-section` | 0.9375 | 15px  | 600    | 1.3         | −0.005em | `h2` and `panel-head`. Sentence case, `--ink`                            |
| `--t-body`    | 0.875  | 14px  | 400    | 1.45        | 0        | Default running text, table cells                                        |
| `--t-num`     | 0.875  | 14px  | 500    | 1.45        | 0        | Money in tables. Tabular, right-aligned                                  |
| `--t-control` | 0.875  | 14px  | 500    | 1.2         | 0        | Inputs, selects, buttons                                                 |
| `--t-label`   | 0.75   | 12px  | 500    | 1.3         | 0        | Field labels, `th`, tile labels. Sentence case, `--ink-muted`            |
| `--t-caption` | 0.75   | 12px  | 500    | 1.3         | 0        | Tags, panel meta, row meta                                               |

The ramp is deliberately **wider than it was**. The previous scale ran 26 / 20 / 17 / 14 / 13 / 12 /
11 — four of those sizes within 3px of each other — so below the hero there was no hierarchy left
and every screen flattened into one grey field. 28 / 22 / 20 / 15 / 14 / 12 gives a page head, a
section head and a tile figure that each outrank the body without anything shouting.

### Rules

- **Every figure is tabular.** Money, percentages, dates in numeric form, counts. No exceptions — a
  single proportional column breaks the scan.
- **Money is right-aligned. Labels are left-aligned.** Always. The decimal point is the alignment
  axis in a dense table.
- **Size and weight together carry hierarchy — never case.** No `text-transform: uppercase` with
  tracking on a label, anywhere. That treatment appeared on `h2`, `th`, `.kpi .label`, `.tag`,
  `.rail-section` and the phone card labels simultaneously, which is six things all shouting at the
  same pitch and none of them ranking.
- **Maximum two type sizes per component.** A KPI tile is `--t-label` + `--t-figure`. A table row is
  `--t-body` + `--t-num`. If a third size seems necessary, the component is doing too much.
- **Negative tracking on the large sizes only.** Headline figures tighten (−0.025em at 28px);
  body and labels never do. Tracking out a small label is what the old scale did and it is the
  single most dating typographic habit in the system.
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
| Table row                     | 32px + hairline | 20px line box + 6px top/bottom → 33px pitch                          |
| Table header                  | 32px + hairline | `--sunk`, sticky                                                     |
| Control (input/select/button) | 32px            | The system's baseline control height                                 |
| Row-level icon button         | 24px            | **Not** a control — a 32px button in a padded cell forces a 44px row |
| Rail item                     | 34px            | Slightly taller — it is a pointer and touch target                   |
| Mobile row / tab / icon       | 44px            | Touch minimum, applied below `40rem` only                            |

Cell padding is **6px vertical / `--space-3` horizontal**. The 12px horizontal figure is what stops
adjacent money columns from colliding at this row height; the 6px vertical figure is what puts the
row on 32px.

The 32px control height is what makes the ledger entry bar and the table it sits above read as one
instrument. Do not introduce a second control height for "comfortable" mode.

> **Superseded: 28px.** The previous row and control height was 28px with 4px of cell padding. It
> fit two more transactions on a laptop screen and read as cramped, which was half of why the app
> felt lifeless. 32px is the deliberate trade: roughly two rows of density spent to buy a screen
> that does not feel like a spreadsheet from 2011.

Cells set an explicit **`line-height: 20px`** rather than inheriting the unitless 1.45. Without it a
cell's line box drifts with its contents — a tag, an icon button or a nested `<form>` each contribute
baseline descender space — and rows stop landing on a common pitch. For the same reason, inline-block
content inside cells is `vertical-align: middle` and cell-level forms are `display: flex`. This is the
difference between a 29px row and a 37px one, which is four extra transactions on a laptop screen.

### Grid & container

- **Shell:** rail (fixed) + main (fluid). No right rail — Freyr's screens are one table wide.
- **Main max width:** `100rem` (1600px). Beyond that, tables get gutters rather than stretching; a
  2400px-wide transaction row is unreadable.
- **Sections:** a `panels` grid, `repeat(auto-fit, minmax(min(--panel-min, 100%), 1fr))` with
  `--panel-min` at `36rem`. Screens wide enough for two tables get two; narrower ones get one. The
  wrap point follows the container, so it holds at any zoom level without a breakpoint.
- **Forms:** capped at `36rem` when standalone (auth). The ledger entry bar is full-width by design —
  it is a toolbar, not a form.
- **Tables:** `width: 100%`, `table-layout: auto`. The amount column gets a `min-width` so it never
  collapses under a long note.

#### Column rhythm

Every cell is `width: 1%` and `white-space: nowrap`; exactly one column per table carries `.grow`,
which is `width: auto` and the only column allowed to wrap.

This exists because a 100%-wide auto-layout table hands its slack to whichever column will take it.
On a 1440px screen that put a bucket's name at x=225 and its Remaining at x=1400 — a row you have to
read across the whole display — and right-aligned a `2026-08-08` some 350px from its own row's left
edge with a void beside it. Asking every column for its content's width and nominating one absorber
keeps a figure beside the row it describes at any width.

The nominated column is the one that genuinely wants room: a note, or the row's name. A table of
pure figures nominates none and takes `.tight` instead.

- **`.tight`** — `width: fit-content` on the panel and `width: auto` on its table. For a table whose
  columns all want their content and nothing more (monthly's six-column bucket table). The panel
  takes what it needs and the rest of the screen becomes gutter, which is this section's rule applied
  at the panel instead of at the shell.
- **`.wide`** — `grid-column: 1 / -1`. For a table that earns the whole measure (the ledger's seven
  columns with real notes) and for the entry bar, which must span the table it writes to.

The phone reflow overrides both the `1%` and the nowrap: below `40rem` cells are a card's lines, not
columns, and the column rhythm would collapse every line and clip every note.

### Whitespace philosophy

Whitespace separates _sections_, never rows. Inside a table, separation is a 1px hairline and nothing
else. This is the opposite of a marketing layout and it is the correct call: the user is scanning for
one transaction among sixty, and every pixel of row padding is one fewer row on screen.

---

## Elevation & Depth

| Level    | Treatment                                         | Use                                                        |
| -------- | ------------------------------------------------- | ---------------------------------------------------------- |
| Flat     | No border, no shadow                              | Page background, section headings                          |
| Hairline | 1px `--line`                                      | Table dividers, section rules                              |
| Card     | 1px `--line` + `--shadow-card`                    | Panels, KPI tiles, the entry bar, primary buttons          |
| Control  | 1px `--line-strong`                               | Inputs, selects, secondary buttons — meaningful edges, 3:1 |
| Sunk     | `--sunk` fill                                     | Table headers, disabled inputs, inset wells                |
| Raised   | 1px `--line` + `--shadow-raised`                  | Dialogs and popovers **only**                              |
| Focus    | `outline: 2px solid --focus; outline-offset: 1px` | Every interactive element                                  |

```
--shadow-card    0 1px 2px rgb(16 24 40 / 0.04), 0 1px 3px rgb(16 24 40 / 0.06)
--shadow-raised  0 8px 24px rgb(16 24 40 / 0.12), 0 2px 6px rgb(16 24 40 / 0.08)
```

Two stacked shadows, both nearly transparent: the tight one draws the edge, the loose one seats the
element on the canvas. That is the entire depth budget — a card outranks the table inside it, a
dialog outranks the page, and nothing else floats.

Still **no glassmorphism, no gradient surfaces, no atmospheric backdrops, no coloured shadows**. The
previous rule was "no shadows except on dialogs", which left panel, tile, table and input all
carrying identical visual weight; a card that cannot outrank its own contents is not a card.

---

## Shapes

| Token      | Value  | Use                                                |
| ---------- | ------ | -------------------------------------------------- |
| `--r-0`    | 0      | Table cells, sticky headers, full-bleed bars       |
| `--r-1`    | 6px    | Inputs, selects, buttons                           |
| `--r-2`    | 8px    | Cards, panels, the entry bar, notices              |
| `--r-3`    | 12px   | Dialogs, the auth card                             |
| `--r-full` | 9999px | Tags, avatars, the progress meter and its fill cap |

Radius is soft but never uniform-round. Large rounding on everything is still the strongest single
tell of generic AI-generated UI; 3px corners were the opposite error, and read as the chrome of a
2011 admin panel. 6/8/12 is the middle that looks current without looking generated. Tags are the
one fully-round element — a pill is what a tag is.

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

Names below are this system's **vocabulary** — the handle for saying which component you mean — and
not, with a handful of exceptions, selectors. `src/app.css` writes most of them shorter, and several
are element or compound selectors rather than a class at all. The names are what a review, a commit
message and the Iteration Guide use; the table is how you find the CSS. Renaming the stylesheet to
match would touch every template for no gain, so the mapping is written down instead.

There is no component library: appearance is a class, and a `.svelte` file exists only where the same
_markup_ repeats across pages (those names are real paths under `src/lib/components/`).

| Component            | Styled in `src/app.css` by                                                               |
| -------------------- | ---------------------------------------------------------------------------------------- |
| `app-shell`          | `.shell`                                                                                 |
| `rail`               | `.rail` — literal, with `.rail-section`, `.rail-spacer`, `.rail-foot`, `.rail-btn`       |
| `rail-item`          | `.rail-item` — literal                                                                   |
| `rail-brand`         | `.rail-brand` — literal, plus `.wordmark`                                                |
| `topbar`             | `.topbar` — literal, label in `.topbar-title`                                            |
| `tabbar-mobile`      | `.tabbar`                                                                                |
| `theme-toggle`       | no class of its own — `ThemeToggle.svelte`; `.rail-btn` in the rail, bare above it       |
| `page-head`          | `.page-head`, with `.context` and the `.actions` cluster                                 |
| `panel-grid`         | `.panels`, with the `.wide` and `.tight` modifiers on its children                       |
| `panel`              | `.panel`, head in `.panel-head` (+ `.meta`), prose in `.panel-body`                      |
| `prose`              | `.prose`                                                                                 |
| `kpi-strip`          | `.kpis`                                                                                  |
| `kpi-tile`           | `.kpi`, with `.label` and `.value`                                                       |
| `data-table`         | the bare `table` / `th` / `td` elements; `.table-wrap` is the scroller around it         |
| `money-cell`         | `td.num` and `td.amount` on the cell; `Money.svelte` for the value (`.pos` / `.faint`)   |
| `delta-cell`         | `.delta`, with `.pos` / `.neg` / `.flat`                                                 |
| `bucket-tag`         | `.tag`                                                                                   |
| `progress-meter`     | `.meter` (+ `.warn` / `.over`, `.fill`, `.over-seg`); `.meter-cell` pairs it with `.pct` |
| `goal-row`           | no class — a `<tr>` in home's goals table                                                |
| `month-stepper`      | `.stepper`, label in `.stepper .current`                                                 |
| `filter-bar`         | `.page-head .actions` — a `<form>` on `/ledger` and `/yearly`                            |
| `sparkline`          | not built — see Known Gaps                                                               |
| `empty-state`        | `.empty`; the phone layout adds `tbody td.empty`                                         |
| `entry-bar`          | `.entry`, inside the `.entry-wrap` disclosure                                            |
| `field`              | `.field` — literal                                                                       |
| `input-text`         | the `input` element                                                                      |
| `select`             | the `select` element                                                                     |
| `input-date`         | `input[type='date']`                                                                     |
| `input-money`        | `input.money`                                                                            |
| `button-primary`     | `button.primary`                                                                         |
| `button-secondary`   | the `button` element's own style                                                         |
| `button-ghost`       | `button.ghost`                                                                           |
| `button-danger-icon` | `button.icon`                                                                            |
| `notice`             | `.notice` — literal                                                                      |
| `error-text`         | `.error`                                                                                 |
| `auth-shell`         | `.auth`                                                                                  |
| `auth-card`          | `.auth-card` — literal                                                                   |

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

**`rail-item`** — 34px tall, `--space-2` horizontal padding, `--r-1`, 16px icon + `--t-body` label,
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

**`theme-toggle`** — A form button posting to `/theme`, a `+server.ts` endpoint that sets the cookie
and redirects back. Sun icon in dark mode, moon in light. Label
is `aria-label="Switch to light theme"` / `"Switch to dark theme"` — the icon shows the destination,
the label says it out loud.

### Page structure

**`page-head`** — Every screen opens the same way: `h1`, an optional `context` naming the period or
scope it is showing, then an `actions` cluster pushed right with `margin-left: auto`. A hairline
bottom edge closes the band. The screen's own controls — the ledger's filters, the yearly year
select, the month stepper — all live in `actions`, so the control corner is in one place on every
page and the eye only has to learn it once.

**`panel`** — The section container: `--surface`, 1px `--line`, `--r-2`. A `panel-head` carrying an
`h2` and an optional right-aligned `meta` (a count, a total, a link to the full table), then the
table or the `panel-body` prose. A table inside sheds its own border and fill — the panel has
already drawn them, and a second box 1px inside the first is not depth, it is a mistake.

Before this existed, a section was a bare `h2` floating above an unrelated bordered table,
which is why home could put an "Add" heading between two tables and strand a Lendings line at the
foot of the page. On a phone the panel drops its box: the rows have already become cards, and a
border around a stack of bordered cards is noise. The head stays — it is the only thing naming the
section there.

**`prose`** — The explanatory paragraph a screen needs to define a column before the reader meets
the figures (yearly's Allocated share, the budget policy's asymptote). `--t-body` in `--ink-muted`,
capped at `68ch`. The cap is the whole point: these previously ran the full width of the page, which
is about 180 characters and unreadable as prose.

### Data display

**`kpi-strip`** — `display: grid; grid-template-columns: repeat(auto-fit, minmax(11rem, 14rem))`.
The row of summary tiles at the top of a screen. Equal tracks so the figures line up down a column,
capped at `14rem` so three tiles on a wide screen stay a strip rather than stretching into three
quarter-page banners. One per row below `40rem`.

**`kpi-tile`** — `--surface`, 1px `--line`, `--r-2`, `--shadow-card`, `--space-4` padding. Two lines
only: `--t-label` in `--ink-muted` sentence case, then `--t-figure` tabular in `--ink`. An optional
third element is a `delta-cell`. Never an icon — a big icon in a stat card is filler.

A tile may not repeat a figure the screen's `hero` already carries. Home's headline reports what is
left, of what was allocated, with how many days to go, so its tiles are income, spent and lendings
outstanding — three facts the sentence does not state. The same figure under two labels reads as two
facts.

**`data-table`** — `--surface`, 1px `--line`, `--r-2`, `border-collapse: collapse`. `--t-body`.
Header row is `--sunk`, `--t-label` at weight 500 in sentence case, `position: sticky; top: 0`. Rows separated by 1px
`--line`; last row has none. Hover: `--hover`. This is the primary component of the entire
application — everything else exists to support it. Inside a `panel` it drops its own border and
fill. Column widths follow § Column rhythm.

**`date-cell`** — `td.date`: tabular, left-aligned, rendered through `shortDate` in
`src/lib/dates.ts` as `08 Aug`, or `08 Aug 25` on a row outside the year the screen is scoped to. A
date is the row's label, not one of its figures, so it is not right-aligned like money — and a
column of `2026-08-`-prefixed strings gives the eye no purchase for finding a row.

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

**`bucket-tag`** — A `--r-full` pill naming a bucket (needs / wants / investments). `--t-caption` at
weight 500, capitalised rather than uppercased, `--sunk` fill, `--ink-muted` text, 1px `--line`.
Deliberately monochrome: buckets are categories, not directions, and colouring them would spend the
semantic budget that gain/loss needs.

**`progress-meter`** — A 5.5rem × 6px track, `--r-full`, `--sunk` fill, 1px `--line`,
`overflow: hidden`. Below 80%
of allocation the fill is `--brand`; 80–100% it is `--accent`. Always paired with a text percentage,
beside it or in the next column — the bar is a glance, the number is the truth. No allocation to
measure against renders `—`, not an empty track.

The track is **5.5rem, not the 8rem it once was**, because its cell is the widest non-money column
in a bucket table: at 8rem the table laid out 18px past its panel and clipped the Remaining figure.
The width came out of the bar rather than out of a money column precisely because the bar is the
glance and the percentage beside it is the truth.

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
Keyboard: left/right arrows step when the group has focus. The label is a `<span>`, not a heading —
the page's own `<h1>` names the screen, a second one would break the one-per-page landmark rule, and
an `<h2>` here would sit above the page's real `<h2>` and invert the outline. The group carries
`role="group"` with an `aria-label` instead, which is what actually names it for a screen reader.

**`filter-bar`** — A `GET` form of selects, `--space-2` gaps, wrapping. Auto-submits on change with a
`<noscript>` submit button as the fallback. No "Apply" button when JS is on. It is the `actions`
cluster of the `page-head`, not a row of its own beneath the heading — a control that chooses what
the screen shows belongs in the same corner as every other such control, and a separate toolbar row
spent 28px of vertical space to say so twice.

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

**`field`** — `--t-label` label above a control, `--space-1` gap. Labels are always present and always
visible; placeholder-as-label is not permitted.

**`input-text` / `select` / `input-date`** — 32px, `--space-3` horizontal padding, 1px
`--line-strong`, `--r-1`, `--surface` fill, `--t-control`. Hover: border to `--ink-faint`. Focus: 2px
`--focus` outline, 1px offset. Disabled: `--sunk` fill, `--ink-faint` text.

**`input-money`** — As `input-text` but right-aligned, tabular, `inputmode="decimal"`, `7rem` wide,
with a `₹` prefix in `--ink-muted`. Accepts grouped input (`1,250.50`); `src/lib/money.ts` owns
parsing.

**`button-primary`** — `--brand` fill, `--on-brand` text (white light / near-black dark), 32px, `--r-1`,
`--shadow-card`, `--t-control` at weight 500. Hover `--brand-hover`. One per screen region.

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

The one exception is a **row delete**, whose form is a single button inside a `<td>`: there is no
control it could sit under, and a paragraph in a table row is not a place a message can go. It
renders above the table instead — still the nearest position in reading order that exists.

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
- Don't use `--accent` for body text in light mode — it reaches 4.01:1 at best and 3.54:1 on
  `--sunk`. Use `--accent-text`.
- Don't use `--ink-faint` for anything a user must read. It is a 3:1 decorative token.
- Don't set `html { font-size }` in pixels. It overrides the reader's browser preference.
- Don't add a second control height, a "comfortable" mode, or a density toggle. One density, chosen
  correctly.
- Don't introduce a third brand color. The system is evergreen and amber.
- **Don't uppercase and letterspace a label to make it look like a label.** Sentence case at
  `--t-label` in `--ink-muted` is what a label looks like here. The uppercase treatment is the
  single most dating habit this system had, and it had spread to six components at once.
- Don't push depth past `--shadow-card`. Hairlines, the `--sunk` step and one 4%-opacity shadow are
  the whole budget; anything heavier is elevation theatre.
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
prints a heading over a blank value.

### Touch

Stated per control class and **measured against `src/app.css`**, not asserted as a blanket figure:

- **Targets that are small in both axes are ≥ 44×44px below `40rem`.** The row delete
  (`button.icon`, 24px in a desktop row) and the month-stepper arrows both go to 44×44; the tab bar's
  tabs are 52 tall and a fifth of the viewport; the `entry-bar` disclosure is 44 tall and full width.
- **Text inputs, selects and buttons are 36px tall, not 44** — `input, select, button { height: 36px }`,
  up from the 32px `--control-h` that desktop uses. They are full-width or text-labelled, so the
  target is a wide band and only the height is under 44: that clears WCAG 2.2 AA's 24×24 minimum with
  room to spare, where 44×44 is the AAA figure. Raising it would spend 8px per control on the densest
  screens in the app — `entry-bar` stacks eight of them on a phone — to enlarge targets nobody misses.
  A deliberate, measured exception; re-measure before changing that rule, and change the doc with it.
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
