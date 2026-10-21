# Design

<!-- impeccable:design-schema 1 -->

## The world

**Night Watch.** A chart table in a darkened wheelhouse: graphite surfaces dyed blue-green rather than neutral grey, bone-coloured text, hairline seams where one surface meets the next, and a single signal vermilion that marks position and nothing else.

The test for anything added: does it read as part of one instrument panel, or as a component dropped onto a page? The panel wins or the thing is cut.

## Color

Restrained strategy. Neutrals carry the interface; one accent does one job.

| Token | Value | Role |
|---|---|---|
| `--ground` | `#0b1420` | The writing field and the read document. The floor. |
| `--ground-2` | `#0e1a28` | Persistent chrome: top bar, status strip, settings rail. |
| `--ground-3` | `#122132` | Raised inside a panel: buttons, tab fills, hover. |
| `--ground-4` | `#17293c` | Selected and pressed fills. |
| `--rule` | `#1d2f42` | The visible seam between two regions. |
| `--rule-soft` | `#16273a` | Subdivision inside a region. |
| `--rule-hard` | `#2b4256` | A seam that needs emphasis, or a control border on hover. |
| `--ink` | `#e8e2d4` | Primary text. Warm bone, never pure white. |
| `--ink-2` | `#b3bfca` | Secondary text and metadata values. 8.4:1 on ground. |
| `--ink-3` | `#8b9dae` | Field labels, quiet actions. 5.3:1 on ground. |
| `--ink-4` | `#7a8d9f` | Non-text marks and disabled text. |
| `--signal` | `#e2543a` | Position: the live caret, the active row, the primary action. |
| `--sea` | `#4f9d8a` | Confirmation only. Never decorative. |
| `--danger` | `#d8503c` | Error text on ground is `#f0a396`; the base is for fills. |

**The accent rule.** Vermilion marks where you are or what to press. It is never a heading colour, never a border on a card, never a gradient. Two vermilion elements on one screen is one too many, unless one is the caret.

**Dark is not a default here.** Stow is used beside an editor at night, reading code for minutes at a time; a light ground would be the wrong room. That is the reason, and it is the only one that would justify the choice.

## Type

| Role | Face | Why |
|---|---|---|
| Interface | Archivo Variable | An industrial grotesque drawn for signage and dense readouts. It sets `13px` labels cleanly and holds its shape at `9px`. |
| Entry text | Martian Mono Variable | Wide, unmistakable, and clearly a machine voice. It is what the document is, so it is what the document is set in. |

Scale runs `9 / 10.5 / 11.5 / 12.5 / 14 / 16 / 19 / 24`. There is no display size: this is an operating surface, and a headline larger than `24px` would be a poster pretending to be a tool.

Both faces are self-hosted woff2 from `@fontsource-variable`, loaded with `font-display: swap`. No hosted font stylesheet ships.

## Shape and elevation

- **Radii:** `2px` on controls, `3px` on nothing yet, `0` on surfaces. Anything that holds a region of the screen is square, because regions are bounded by seams, not by containers.
- **Elevation:** a hairline or one step of ground. Never a shadow. The only shadow in the product is the toast, and it exists because the toast floats above the shell and must separate from whatever is beneath it.
- **No cards.** There is no card component, and there never will be. Grouping is done with a seam, a band, or space.

## Layout

The shell is exactly one viewport, in three rows: a `52px` top bar, a flexible middle, a `40px` status strip. Nothing scrolls the page as a whole; the middle band scrolls its own content. This is an application, not a document.

The middle band splits into a document surface and a `300px` settings rail. The rail is the reason this layout exists: every fact about an entry is visible while it is being written, so stowing never involves opening a second screen or a modal.

Below `900px` the rail moves under the document, the top bar keeps only the actions, secondary actions compact to their icons, and the title keeps its room.

## Motion

One authored moment, used sparingly: `settle`, a `6px` rise on an exponential ease-out from an already-visible state. It runs once on the unlock panel, the 404 panel, and the about page.

Everything else is a `90ms` linear transition on colour or border. The caret blinks on `steps(1)`. `prefers-reduced-motion` sets every duration to `0ms` rather than shortening it.

## Browser surfaces

The parts not drawn by the app still belong to it: selection is a vermilion wash, the caret is vermilion, scrollbars are thin and take `--rule-hard`, focus is a `1px` vermilion outline offset by `2px`, and code figures are tabular.

## Code rendering

Prism highlights one line at a time, so the gutter is real rows that always align and long lines can be wrapped without breaking a token tag. The trade is honest: a token spanning newlines, such as a block comment, loses its colour on continuation lines. Highlighting the block and splitting the resulting markup either misaligns the gutter or splits a tag, which is worse for the thing people came to read.

Syntax colours sit between `5:1` and `9:1` on the ground. Code is the content; it does not get decorative low-contrast treatment.

## Writing an entry

A transparent `<textarea>` sits exactly on a highlighted `<pre>`. Both read the same custom properties (`--code-line`, `--pad-top`, `--pad-left`) from `.editor`, so the caret, the colour and the gutter can only move together. Changing one number moves all three.

## States

Every surface has all five: loading (skeletons shaped like the content they replace), empty (the editor's placeholder and a disabled action), error (an inline band that names the problem and how to recover), success (a toast and a status line), and locked (a full interruption, because the body genuinely is not in the browser yet).

## Documents

The API reference, terms, privacy notice and about page share one reading surface, `DocLayout`. It renders its own `Shell`, so a document cannot lose the top bar and status strip by forgetting to wrap itself.

A sticky contents rail occupies `196px` on the left and marks the current section with a vermilion rule; the text holds a `68ch` column. Below `860px` the rail becomes a wrapping row of section links above the text, because a 200px sidebar beside 340px of prose serves nobody.

Endpoint signatures and parameter tables use a fixed three-column grid with a monospaced first column. On a phone the third column moves under its row rather than being dropped: a table cell that vanishes is a table that lies.

Code samples (`Snippet`) are bounded by a hairline with a label seam, no line numbers and no wrap toggle. That is the difference between a sample, which is read once, and a document, which is worked in.

## Anti-patterns this world refuses

Icon-plus-heading cards, gradient text, glassmorphism, page scaffolds made of equal tiles, and any shadow standing in for structure.
