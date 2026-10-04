<p align="center">
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="18" rx="3"/><polyline points="7 12 10 9 7 6"/><line x1="12" y1="15" x2="17" y2="15"/></svg>
</p>

<h1 align="center">json2env</h1>

<p align="center"><strong>JSON ⇄ .env Converter — fast, private, fully offline.</strong></p>

<p align="center">
  <a href="https://json2env.tjhexa.com"><strong>● Live Demo — json2env.tjhexa.com</strong></a>
  &nbsp;·&nbsp;
  <a href="https://github.com/tjhexa/json2env">Source on GitHub</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/offline-100%25_local-34d399?style=flat-square" alt="100% offline" />
  <img src="https://img.shields.io/badge/deps-0-0b1220?style=flat-square" alt="zero dependencies" />
  <img src="https://img.shields.io/badge/themes-dark_+_light-9fadc4?style=flat-square" alt="dark and light themes" />
</p>

> Source: <https://github.com/tjhexa/json2env> · Live: <https://json2env.tjhexa.com>

Convert JSON to `.env` and back. Fast, private, fully offline — no uploads, no tracking, zero dependencies.

**Try it now → <https://json2env.tjhexa.com>** — or open `index.html` directly in a browser. Everything runs locally.

## Quick start

```bash
# Option 1: just open it
xdg-open index.html

# Option 2: serve locally (any static server works)
python3 -m http.server 8000
# → http://localhost:8000/index.html
```

No build step. No `npm install`. No network calls.

## Features

**Core (logic preserved from `old/json2env.html`)**

- JSON → `.env`: nested objects flatten to `UPPER_SNAKE_CASE`
- `.env` → JSON: splits on `_`, lowercases segments, rebuilds nesting
- Arrays of primitives join as comma lists (`FEATURES=auth,api`)
- Arrays of objects use numeric segments (`NESTED_0=…`)
- Auto-typing on parse: `true`/`false`, safe integers, comma lists
- `null` / empty values write as empty assignments (`KEY=`)
- `export KEY=value` prefixes and quoted values are accepted on input

**Power-tool additions**

- Live convert as you type (debounced, toggleable, per-side aware)
- Copy, download, and clear per side + “Clear all” and “Swap sides”
- File upload (button + drag-drop onto either editor)
- Prettify JSON button
- Options: header comment (`# Environment Variables`), sort keys A–Z
- Live stats: lines · keys / vars per panel
- 3 one-click samples (basic, nested + arrays, start-from-`.env`)
- Dark + light themes (persisted, respects `prefers-color-scheme`)
- Toast status + inline errors with `aria-live`
- Unsaved-work guard via `beforeunload`

## Project structure

```text
.
├── index.html          # semantic shell: hero, options, converter, rules, samples
├── styles.css          # offline theme (dark + light), no frameworks, no webfonts
├── app.js              # conversion core + UI wiring, zero dependencies
├── .gitignore          # ignores local-only old/ archive
└── README.md
```

> Note: `old/json2env.html` (the original single-file Bootstrap version) lives
> only on your local machine. It is listed in `.gitignore` and is intentionally
> **not** committed — the conversion logic from it is preserved in `app.js`.
> The page header (“GitHub” button) and footer both link directly to
> <https://github.com/tjhexa/json2env> so users can jump to the source.

Fully offline by request: no CDN, no `@import`, no webfont downloads.
Typography uses OS-native stacks (`system-ui` + `ui-monospace`) tuned with
weight, spacing, and scale to stay sharp without network fonts.

## Conversion rules

| # | Rule | Example |
|---|------|---------|
| 1 | Nesting becomes `UPPER_SNAKE` | `{ "db": { "host": "x" } }` → `DB_HOST=x` |
| 2 | Simple arrays join with commas | `["auth","api"]` → `FEATURES=auth,api` |
| 3 | Types round-trip | `true`, integers, `""`, and `null` (as empty) survive both directions |

Back-conversion splits keys on `_` and lowercases each segment, so
`APP_PORT` rebuilds as `{ "app": { "port": … } }`.

## Design notes (skills applied)

- **Reading:** developer tool for developers, dark-tech aesthetic.
- **Direction:** Dark Tech / Cyber — deep slate, phosphor-green accent,
  mono-forward, terminal-inspired preview, asymmetric editorial hero.
- **Tokens:** `--bg #0b1220` / light `#f3efe4`, `--surface`, `--accent`
  (`#34d399` dark / `#0e7a4c` light for AA), 8px spacing scale,
  `clamp()` fluid type, `text-wrap: balance` headings.
- **Anti-slop honored:** no Inter default, no purple-blue gradients,
  no pure `#000`/`#fff` page backgrounds, no nested cards, no identical
  card grid (rules use 1 large + 2 small), no centered long text,
  inline SVG icons only (no emoji icons).
- **Motion:** `transform`/`opacity` only, 180–350ms, staggered reveal via
  `IntersectionObserver`, fully disabled under `prefers-reduced-motion`.
- **Guidelines:** single `h1`, hierarchical headings, skip link, real
  `<label>`s, `aria-label` icon buttons, `aria-live` errors + toast,
  `:focus-visible` rings, 44px touch targets, `touch-action: manipulation`,
  `safe-area` insets, `translate="no"` on code tokens, `…` ellipses.

One intentional deviation: the offline constraint overrides the
“never use system font stacks” rule. The stack is the best available
with zero network, compensated with strict hierarchy and mono emphasis
for a code tool.

## Verification

- `node --check app.js` — syntax OK
- Conversion unit probes — flatten, empty arrays, top-level-object guard — pass
- `grep` — zero external *resources* (no CDN, `@import`, webfonts, or Bootstrap); only plain `<a href>` links to GitHub
- Guideline self-check — headings, labels, live regions, focus,
  reduced-motion, touch, safe-area — all pass
- ID wiring check — every `getElementById` target exists in `index.html`
