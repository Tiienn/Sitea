# Sitea Design System — "Drafting Graphite"

Sitea is a land and architecture tool. The UI is a drafting set: warm
graphite surfaces, hairline rules, one red-pen accent, and monospace type
for every number. No glass, no glow, no gradients, no decoration that a
working drawing wouldn't carry.

## Principles

1. **The canvas is the drawing; chrome is the instrument.** UI surfaces are
   quiet and flat so the 3D scene reads as the subject.
2. **One accent.** Red-pen orange (`--color-accent`) marks the active tool,
   the primary action, and nothing else. If two things are orange at once,
   one of them is wrong.
3. **Numbers are mono.** Areas, dimensions, coordinates, shortcuts — always
   `--font-mono` (`.font-mono-data`). Words are never mono.
4. **Hairlines, not shadows.** Separation comes from 1px `--color-border`
   rules. Shadows only lift true overlays (modals, the dock).
5. **Squared geometry.** `rounded-md`/`rounded-lg` (6–10px) on controls,
   `rounded-xl` (12px) max on floating surfaces. Nothing pill-shaped except
   status chips.

## Colors (CSS variables)

```
--color-bg-primary: #131211      (app chrome, sidebar)
--color-bg-secondary: #1b1a18    (panels, cards)
--color-bg-elevated: #252320     (inputs, toggles)
--color-accent: #f04e23          (red pen — active tool, primary action)
--color-accent-hover: #ff6a3d
--color-text-primary: #f2efe9    (warm white ink)
--color-text-secondary: #a8a29a  (annotations)
--color-text-muted: #6f6a62      (faint pencil)
--color-border: rgba(242,239,233,0.08)   (hairline)
--color-success: #4ade80  --color-warning: #fbbf24  --color-danger: #fb7185
```

White text on `--color-accent` buttons (`#fff`), never dark-on-orange.

## Typography

| Use | Font | Weight | Size |
|-----|------|--------|------|
| Wordmark / display | Archivo (`--font-display`) | 700–800, uppercase, tracking-wide | 14–24px |
| Section titles | Archivo | 600 | 14–16px |
| Body | IBM Plex Sans (`--font-body`) | 400 | 13–14px |
| Labels / captions | IBM Plex Sans | 500 | 11–12px |
| Measurements, coords, shortcuts | IBM Plex Mono (`--font-mono`, `.font-mono-data`) | 400–500 | 10–13px |

## Layout shells

- **Desktop (lg+)**: `AgentSidebar` (380px, full height, chat only) +
  `CanvasDock` (floating footer toolbar over the scene, centered in the
  canvas region) + tool panels docked at `left: 380px`.
- **Mobile (< lg)**: bottom ribbon + floating chat (legacy shell).

## Spacing

- Buttons: text never touches edges — `px-3 py-2` minimum on compact
  controls, `py-3 px-6` on primary CTAs.
- Panels/modals: `p-6` minimum inner padding; `p-4` for dense sidebars.
- Toolbar items separated by hairline dividers (`w-px bg-border`), not gaps.

## Components

### Dock button (CanvasDock)
icon 16px + label (12px, Plex Sans 500) + mono shortcut chip.
Active: `bg-white/[0.08] text-accent`. Hover: `bg-white/[0.06]`.

### Shortcut chip
`<kbd>` — mono 10px, `border-color-border`, `bg-white/[0.04]`, rounded (4px).

### Status chip
Success/teal-free: `text-success`; saving: `text-warning` + spinner;
errors: `text-danger`. Chips never use the accent.

### Cards in chat
Flat `bg-surface` + hairline; the *recommended* card gets a 2px left rule
in the accent instead of a filled background.
