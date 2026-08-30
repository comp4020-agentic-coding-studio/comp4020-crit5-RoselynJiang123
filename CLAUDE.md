# CLOT / FLOW — project harness

C5 prototype. `CLOT-FLOW-SPEC.md` is the authoritative design spec — read it
before planning or building. This file is the working harness: durable rules
for how to build it, not the spec itself.

## How to work in here

- Keep the dev server running (`pnpm dev`) so you see changes as you make them.
- Rendered output is the truth; your mental model of it isn't.
- Run `pnpm check` before accepting or committing any work.
- Read failed check output before changing code.
- Never commit a red state.
- No unrequested features or refactors.

## The game

One drag mechanic, two opposing risks: too little clotting causes BLEEDING,
too much causes BLOCKED, successful healing causes STABLE. The player first
learns to make a clot, then learns when to stop.

No tutorial text anywhere, on screen or off. The only visible text ever
allowed: `CLOT / FLOW`, `STABLE`, `BLEEDING`, `BLOCKED`, `FLOW xx%`, `↻`.

## Architecture (locked)

- Keep the existing Astro 7 stack. Do not re-initialize Vite or replace the
  starter's deployment infrastructure.
- Game rules are pure and DOM-free (no `document`/`window`/SVG in the rules
  module).
- The renderer reads state and selectors; it never owns game rules.
- Derived values are never stored in state — compute them as selectors.
- Use Pointer Events, with `setPointerCapture` so dragging outside the SVG
  doesn't drop the pointer.
- Convert pointer coordinates into SVG/viewBox space correctly (e.g. via
  `getScreenCTM().inverse()`), not raw client coordinates.
- The interactive SVG area needs `touch-action: none`, or dragging becomes
  page-scrolling on a phone.
- Drive the game loop with `requestAnimationFrame`; clamp frame `dt` to 0.05s
  so an inactive tab doesn't cause a death spiral on return.
- Avoid expensive per-frame SVG filters (blur/glow) on anything that moves
  every frame.

## Human-judgement targets

- Desktop marking viewport: 1920×1080.
- Phone marking viewport: 390×844.
- Automated tests establish that the rules are correct. They cannot establish
  affordance, snap feel, fairness, readability, or pacing — only actual play
  at both viewports can.
- The finished opening screen must make the first interaction discoverable
  without words.

## Scope ban

Tutorial/help text, tooltips, instruction modals, anatomy labels, 3D,
physics/fluid simulation, full clotting-cascade simulation, levels, inventory,
health bar, skill trees, enemies, power-ups, leaderboard, complex menus,
backend, database, excessive particle effects.

## Implementation principle

Every proposed addition must improve one of:

- first-interaction affordance;
- the stop-vs-add decision;
- visual anticipation of failure.

If it improves none of these, do not add it.

## Repo reality

- Astro and the existing GitHub Pages/CI/base-path configuration are already
  correct — do not recreate deployment infrastructure.
- `spec/invariants.test.ts` must remain intact.
- New C5 tests are added alongside the existing invariants, not in place of
  them.
