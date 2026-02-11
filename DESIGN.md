# SiteA Design System

Rules for every UI element. Follow these every time you create or modify a component.

---

## Spacing

**Buttons must have breathing room.** Text should never touch the edges.

| Element | Min Padding | Example |
|---------|-------------|---------|
| Primary button (`.btn-primary`) | `py-3 px-6` (12px 24px) | `<button className="btn-primary py-3 px-6">` |
| Small button / pill toggle | `py-2 px-4` (8px 16px) | `<button className="px-4 py-2">` |
| Tiny button (icon + label) | `py-1.5 px-3` (6px 12px) | `<button className="px-3 py-1.5">` |
| Icon-only button | `p-2.5` (10px) min | `<button className="p-2.5">` |

**Never** use `px-1`, `px-2`, or `py-1` on buttons with text. The text will be unreadable.

## Modals & Panels

Every modal and panel needs inner padding so content doesn't touch the edges.

| Element | Padding | Notes |
|---------|---------|-------|
| Modal / dialog | `p-6` (24px) min | Use `p-8` for large modals |
| Panel (`.panel-premium`) | `p-4` (16px) min | Use `p-5` or `p-6` for sidebars |
| Card inside panel | `p-3` (12px) min | Nested content still needs space |
| Section within modal | `mb-4` between sections | Keep vertical rhythm consistent |

**Modal title** should have `mb-4` (16px) below it before content starts.
**Modal actions** (buttons at bottom) should have `mt-6` (24px) above them.

## Typography

| Use | Font | Weight | Size |
|-----|------|--------|------|
| Display headings | `font-display` (Outfit) | `font-bold` (700) | `text-xl` to `text-2xl` |
| Section titles | `font-display` (Outfit) | `font-semibold` (600) | `text-base` to `text-lg` |
| Body text | DM Sans (default) | `font-normal` (400) | `text-sm` (14px) |
| Labels / captions | DM Sans | `font-medium` (500) | `text-xs` (12px) |
| Tiny labels | DM Sans | `font-medium` (500) | `text-[10px]` or `text-[11px]` |

## Colors (CSS Variables)

```
--color-bg-primary: #0f172a       (darkest background)
--color-bg-secondary: #1e293b     (panels, cards)
--color-bg-elevated: #334155      (inputs, toggles)
--color-accent: #14b8a6           (teal — primary action)
--color-accent-hover: #2dd4bf     (hover state)
--color-text-primary: #f8fafc     (white text)
--color-text-secondary: #94a3b8   (gray text)
--color-text-muted: #64748b       (dim text)
--color-border: rgba(255,255,255,0.08)
```

**Active/selected state:** `bg-[var(--color-accent)] text-[var(--color-bg-primary)]`
**Inactive state:** `text-[var(--color-text-secondary)]`

## Component Patterns

### Pill toggle group (1P/3D/2D style)
```jsx
<div className="panel-premium rounded-xl p-1.5 flex items-center gap-1">
  <button className="px-5 py-2.5 text-base font-bold rounded-lg">Label</button>
</div>
```

### Floating overlay card (guided onboarding style)
```jsx
<div className="panel-premium p-6 max-w-sm text-center">
  <h2 className="font-display font-semibold text-white text-base mb-2">Title</h2>
  <p className="text-[var(--color-text-secondary)] text-sm mb-5">Description</p>
  <button className="btn-primary w-full py-3">Action</button>
</div>
```

### Mobile HUD button (top-right controls)
```jsx
<button className="panel-premium p-3 rounded-xl">
  <svg className="w-6 h-6" ... />
</button>
```

## Key Rules

1. **No cramped text.** Every button with text must have at least `px-4 py-2`.
2. **Modals get `p-6` minimum.** Content must never touch modal edges.
3. **Consistent gaps.** Use `gap-2` (8px) between items, `gap-4` (16px) between sections.
4. **Mobile-first.** Touch targets must be at least 44px tall (`py-2.5` + text).
5. **No layout shifts.** Toggling state must not change a component's width or height.
6. **Transitions on everything interactive.** Add `transition-all` to buttons, toggles, panels.
