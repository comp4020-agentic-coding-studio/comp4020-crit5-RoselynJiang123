// Pointer interaction and magnetic placement for CLOT / FLOW. Geometry only —
// no game rules (see CLAUDE.md "Architecture (locked)").

import type { Platelet } from "./render";
import { yTop, yBot } from "../theme";

const LUMEN_MARGIN = 24;
const FAR_RADIUS = 260;
const MED_RADIUS = 140;
const SNAP_RADIUS = 60;
const HOVER_RADIUS = 70;

export function toSvgPoint(svg: SVGSVGElement, clientX: number, clientY: number) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: clientX, y: clientY };
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function pullFactor(dist: number): number {
  if (dist > FAR_RADIUS) return 0;
  if (dist > MED_RADIUS) return 0.15;
  if (dist > SNAP_RADIUS) return 0.45;
  return 0.8;
}

export type DragDeps = {
  svg: SVGSVGElement;
  getPlatelets: () => Platelet[];
  woundX: number;
  woundY: number;
  onFirstInteraction: () => void;
  setHover: (id: number | null) => void;
};

export function attachDragHandlers(deps: DragDeps) {
  let heldId: number | null = null;

  deps.svg.addEventListener("pointerdown", (e: PointerEvent) => {
    if (heldId !== null) return;
    const p = toSvgPoint(deps.svg, e.clientX, e.clientY);
    let best: Platelet | null = null;
    let bestDist = Infinity;
    for (const pl of deps.getPlatelets()) {
      if (pl.state !== "drifting") continue;
      const d = Math.hypot(pl.x - p.x, pl.y - p.y);
      if (d < HOVER_RADIUS && d < bestDist) {
        best = pl;
        bestDist = d;
      }
    }
    if (!best) return;

    deps.onFirstInteraction();
    heldId = best.id;
    best.state = "held";
    best.x = p.x;
    best.y = p.y;
    deps.svg.setPointerCapture(e.pointerId);
  });

  deps.svg.addEventListener("pointermove", (e: PointerEvent) => {
    const p = toSvgPoint(deps.svg, e.clientX, e.clientY);

    if (heldId === null) {
      let best: Platelet | null = null;
      let bestDist = Infinity;
      for (const pl of deps.getPlatelets()) {
        if (pl.state !== "drifting") continue;
        const d = Math.hypot(pl.x - p.x, pl.y - p.y);
        if (d < HOVER_RADIUS && d < bestDist) {
          best = pl;
          bestDist = d;
        }
      }
      deps.setHover(best ? best.id : null);
      return;
    }

    const held = deps.getPlatelets().find((pl) => pl.id === heldId);
    if (!held) {
      heldId = null;
      return;
    }
    const dist = Math.hypot(p.x - deps.woundX, p.y - deps.woundY);
    const pull = pullFactor(dist);
    held.x = p.x + (deps.woundX - p.x) * pull;
    held.y = p.y + (deps.woundY - p.y) * pull;
  });

  function release(e: PointerEvent) {
    if (heldId === null) return;
    const held = deps.getPlatelets().find((pl) => pl.id === heldId);
    heldId = null;
    if (!held) return;
    try {
      deps.svg.releasePointerCapture(e.pointerId);
    } catch {
      // capture may already be gone (e.g. pointercancel)
    }
    const dist = Math.hypot(held.x - deps.woundX, held.y - deps.woundY);
    if (dist <= SNAP_RADIUS) {
      held.state = "attaching";
      held.glideFrom = { x: held.x, y: held.y };
      held.glideT = 0;
    } else {
      held.state = "drifting";
      held.vx = Math.abs(held.vx);
      // The held platelet is the only one allowed outside the lumen; on
      // release it returns to drifting inside it, same as every other one.
      const top = yTop(held.x) + LUMEN_MARGIN;
      const bot = yBot(held.x) - LUMEN_MARGIN;
      held.y = Math.min(Math.max(held.y, top), bot);
    }
  }

  deps.svg.addEventListener("pointerup", release);
  deps.svg.addEventListener("pointercancel", release);
}
