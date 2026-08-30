// SVG rendering for CLOT / FLOW. Reads GameState and its selectors; never
// computes game rules itself. See CLAUDE.md "Architecture (locked)".

import {
  clamp01,
  leak,
  oxygen,
  flow,
  PLATELET_SPAWN,
  WOUND_INITIAL,
} from "./rules";
import type { GameState } from "./rules";

export const SVG_NS = "http://www.w3.org/2000/svg";

export const VIEW_W = 1600;
export const VIEW_H = 900;
export const VESSEL_TOP = 380;
export const VESSEL_BOTTOM = 520;
export const WOUND_X = 800;
export const WOUND_Y = 450;

const RBC_MAX = 40;
const RBC_BASE_SPEED = 260;
const RBC_SPAWN_INTERVAL = 0.12;
const RBC_QUEUE_ZONE = 140;

const PLATELET_MAX_DRIFTING = 4;
const PLATELET_BASE_SPEED = 90;
export const PLATELET_RADIUS = 12;
export const PLATELET_HIT_RADIUS = 34;

const GLIDE_DURATION = 0.15;
const HINT_DURATION = 0.5;
const HINT_AMPLITUDE = 26;

const FIBRIN_MAX = 5;
const DRIP_PERIOD = 1.2;

let rbcIdSeq = 0;
let plateletIdSeq = 0;

export type RBC = { id: number; x: number; y: number; laneOffset: number };

export type Platelet = {
  id: number;
  x: number;
  y: number;
  vx: number;
  wobblePhase: number;
  state: "drifting" | "held" | "attaching" | "attached";
  glideFrom?: { x: number; y: number };
  glideT: number;
};

export type Fibrin = { angle: number; length: number; bow: number };

export type VisualState = {
  rbcs: RBC[];
  platelets: Platelet[];
  fibrin: Fibrin[];
  hoveredId: number | null;
  rbcSpawnT: number;
  plateletSpawnT: number;
  hintActive: boolean;
  hintT: number;
  hintTargetId: number | null;
};

export function createVisualState(): VisualState {
  return {
    rbcs: [],
    platelets: [],
    fibrin: [],
    hoveredId: null,
    rbcSpawnT: 0,
    plateletSpawnT: 0,
    hintActive: false,
    hintT: 0,
    hintTargetId: null,
  };
}

export function stepRBCs(visual: VisualState, gameState: GameState, dt: number) {
  const f = flow(gameState);
  const speed = RBC_BASE_SPEED * (0.15 + 0.85 * f);
  const targetCount = Math.round(RBC_MAX * clamp01(0.35 + 0.65 * gameState.bloodVolume));

  visual.rbcSpawnT += dt;
  while (visual.rbcSpawnT >= RBC_SPAWN_INTERVAL && visual.rbcs.length < targetCount) {
    visual.rbcSpawnT -= RBC_SPAWN_INTERVAL;
    visual.rbcs.push({
      id: rbcIdSeq++,
      x: -20,
      y: VESSEL_TOP + 20 + Math.random() * (VESSEL_BOTTOM - VESSEL_TOP - 40),
      laneOffset: Math.random() * Math.PI * 2,
    });
  }

  for (const rbc of visual.rbcs) {
    const nearWound = Math.abs(rbc.x - WOUND_X) < RBC_QUEUE_ZONE;
    const localSpeed = nearWound ? speed * (0.25 + 0.75 * f) : speed;
    rbc.x += localSpeed * dt;
  }
  visual.rbcs = visual.rbcs.filter((r) => r.x <= VIEW_W + 20);
}

export function stepPlateletsDrift(visual: VisualState, dt: number) {
  visual.plateletSpawnT += dt;
  const driftingCount = visual.platelets.filter((p) => p.state === "drifting").length;
  if (visual.plateletSpawnT >= PLATELET_SPAWN && driftingCount < PLATELET_MAX_DRIFTING) {
    visual.plateletSpawnT = 0;
    visual.platelets.push({
      id: plateletIdSeq++,
      x: -20,
      y: VESSEL_TOP + 30 + Math.random() * (VESSEL_BOTTOM - VESSEL_TOP - 60),
      vx: PLATELET_BASE_SPEED * (0.8 + Math.random() * 0.4),
      wobblePhase: Math.random() * Math.PI * 2,
      state: "drifting",
      glideT: 0,
    });
  }

  for (const p of visual.platelets) {
    if (p.state !== "drifting") continue;
    p.wobblePhase += dt * 1.6;
    p.x += p.vx * dt;
    p.y += Math.sin(p.wobblePhase) * 6 * dt;

    if (visual.hintActive && visual.hintTargetId === p.id) {
      const bump = Math.sin(clamp01(visual.hintT / HINT_DURATION) * Math.PI) * HINT_AMPLITUDE;
      const dx = WOUND_X - p.x;
      const dy = WOUND_Y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.x += (dx / d) * bump * dt * 4;
      p.y += (dy / d) * bump * dt * 4;
    }
  }

  if (visual.hintActive) {
    visual.hintT += dt;
    if (visual.hintT >= HINT_DURATION) {
      visual.hintActive = false;
      visual.hintT = 0;
      visual.hintTargetId = null;
    }
  }

  visual.platelets = visual.platelets.filter(
    (p) => p.state !== "drifting" || p.x <= VIEW_W + 20,
  );
}

export function stepAttaching(visual: VisualState, dt: number): number[] {
  const completed: number[] = [];
  for (const p of visual.platelets) {
    if (p.state !== "attaching" || !p.glideFrom) continue;
    p.glideT += dt / GLIDE_DURATION;
    const t = clamp01(p.glideT);
    const eased = 1 - Math.pow(1 - t, 3);
    p.x = p.glideFrom.x + (WOUND_X - p.glideFrom.x) * eased;
    p.y = p.glideFrom.y + (WOUND_Y - p.glideFrom.y) * eased;
    if (t >= 1) {
      p.state = "attached";
      p.x = WOUND_X;
      p.y = WOUND_Y;
      completed.push(p.id);
    }
  }
  return completed;
}

export function addFibrinFor(visual: VisualState) {
  if (visual.fibrin.length >= FIBRIN_MAX) return;
  visual.fibrin.push({
    angle: Math.random() * Math.PI * 2,
    length: 20 + Math.random() * 26,
    bow: (Math.random() - 0.5) * 18,
  });
}

export function triggerIdleHint(visual: VisualState) {
  if (visual.hintActive) return;
  const drifting = visual.platelets.filter((p) => p.state === "drifting");
  if (drifting.length === 0) return;
  let nearest = drifting[0];
  let bestD = Infinity;
  for (const p of drifting) {
    const d = Math.hypot(p.x - WOUND_X, p.y - WOUND_Y);
    if (d < bestD) {
      bestD = d;
      nearest = p;
    }
  }
  visual.hintActive = true;
  visual.hintT = 0;
  visual.hintTargetId = nearest.id;
}

export type Refs = {
  vessel: SVGRectElement;
  tissue: SVGRectElement;
  woundGap: SVGEllipseElement;
  clotBulge: SVGCircleElement;
  fibrinGroup: SVGGElement;
  dripGroup: SVGGElement;
  rbcGroup: SVGGElement;
  plateletGroup: SVGGElement;
  idleGlow: SVGCircleElement;
};

function renderDrips(group: SVGGElement, els: SVGCircleElement[], leakValue: number, elapsed: number) {
  const count = Math.round(clamp01(leakValue / 0.5) * 5);
  while (els.length < count) {
    const c = document.createElementNS(SVG_NS, "circle");
    c.setAttribute("r", "4");
    group.appendChild(c);
    els.push(c);
  }
  while (els.length > count) {
    const c = els.pop()!;
    c.remove();
  }
  els.forEach((c, i) => {
    const t = (elapsed / DRIP_PERIOD + i * 0.35) % 1;
    c.setAttribute("cx", String(WOUND_X - 18 + i * 9));
    c.setAttribute("cy", String(WOUND_Y + 12 + t * 90));
    c.setAttribute("opacity", String(clamp01(1 - t)));
  });
}

function renderFibrin(group: SVGGElement, els: SVGPathElement[], fibrin: Fibrin[]) {
  while (els.length < fibrin.length) {
    const p = document.createElementNS(SVG_NS, "path");
    group.appendChild(p);
    els.push(p);
  }
  fibrin.forEach((f, i) => {
    const el = els[i];
    const x1 = WOUND_X + Math.cos(f.angle) * 6;
    const y1 = WOUND_Y + Math.sin(f.angle) * 6;
    const x2 = WOUND_X + Math.cos(f.angle) * f.length;
    const y2 = WOUND_Y + Math.sin(f.angle) * f.length;
    const mx = (x1 + x2) / 2 + Math.cos(f.angle + Math.PI / 2) * f.bow;
    const my = (y1 + y2) / 2 + Math.sin(f.angle + Math.PI / 2) * f.bow;
    el.setAttribute("d", `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
  });
}

function renderRBCs(group: SVGGElement, els: Map<number, SVGCircleElement>, rbcs: RBC[]) {
  const seen = new Set<number>();
  for (const rbc of rbcs) {
    seen.add(rbc.id);
    let el = els.get(rbc.id);
    if (!el) {
      el = document.createElementNS(SVG_NS, "circle");
      el.setAttribute("r", "6");
      group.appendChild(el);
      els.set(rbc.id, el);
    }
    el.setAttribute("cx", String(rbc.x));
    el.setAttribute("cy", String(rbc.y + Math.sin(rbc.laneOffset + rbc.x * 0.02) * 4));
  }
  for (const [id, el] of els) {
    if (!seen.has(id)) {
      el.remove();
      els.delete(id);
    }
  }
}

function renderPlatelets(
  group: SVGGElement,
  els: Map<number, { hit: SVGCircleElement; body: SVGCircleElement }>,
  platelets: Platelet[],
  hoveredId: number | null,
) {
  const seen = new Set<number>();
  for (const p of platelets) {
    seen.add(p.id);
    let pair = els.get(p.id);
    if (!pair) {
      const hit = document.createElementNS(SVG_NS, "circle");
      hit.setAttribute("r", String(PLATELET_HIT_RADIUS));
      hit.setAttribute("class", "platelet-hit");
      const body = document.createElementNS(SVG_NS, "circle");
      body.setAttribute("r", String(PLATELET_RADIUS));
      body.setAttribute("class", "platelet-body");
      group.appendChild(hit);
      group.appendChild(body);
      pair = { hit, body };
      els.set(p.id, pair);
    }
    pair.hit.setAttribute("cx", String(p.x));
    pair.hit.setAttribute("cy", String(p.y));
    pair.body.setAttribute("cx", String(p.x));
    pair.body.setAttribute("cy", String(p.y));

    const hovered = hoveredId === p.id && p.state === "drifting";
    const scale = p.state === "held" ? 1.25 : hovered ? 1.15 : 1;
    pair.body.setAttribute("r", String(PLATELET_RADIUS * scale));
    pair.body.setAttribute("opacity", p.state === "attached" ? "0" : "1");
    pair.hit.setAttribute("pointer-events", p.state === "drifting" ? "auto" : "none");
  }
  for (const [id, pair] of els) {
    if (!seen.has(id)) {
      pair.hit.remove();
      pair.body.remove();
      els.delete(id);
    }
  }
}

export function createRenderer(refs: Refs) {
  const rbcEls = new Map<number, SVGCircleElement>();
  const plateletEls = new Map<number, { hit: SVGCircleElement; body: SVGCircleElement }>();
  const fibrinEls: SVGPathElement[] = [];
  const dripEls: SVGCircleElement[] = [];

  return function render(gameState: GameState, visual: VisualState) {
    const leakValue = leak(gameState);
    const oxygenValue = oxygen(gameState);

    refs.vessel.setAttribute("opacity", (0.35 + 0.55 * clamp01(gameState.bloodVolume)).toFixed(3));
    refs.tissue.setAttribute("opacity", (0.05 + 0.4 * clamp01(oxygenValue)).toFixed(3));

    const woundR = 10 + 46 * clamp01(gameState.woundSize / WOUND_INITIAL);
    refs.woundGap.setAttribute("rx", woundR.toFixed(2));
    refs.woundGap.setAttribute("ry", (woundR * 0.7).toFixed(2));

    const clotAmount = clamp01(gameState.clot);
    refs.clotBulge.setAttribute("r", (8 + 70 * clotAmount).toFixed(2));
    refs.clotBulge.setAttribute("opacity", (0.55 + 0.35 * clotAmount).toFixed(3));

    const glowT = visual.hintActive ? Math.sin(clamp01(visual.hintT / 0.5) * Math.PI) : 0;
    refs.idleGlow.setAttribute("opacity", (0.5 * glowT).toFixed(3));

    renderDrips(refs.dripGroup, dripEls, leakValue, gameState.elapsed);
    renderFibrin(refs.fibrinGroup, fibrinEls, visual.fibrin);
    renderRBCs(refs.rbcGroup, rbcEls, visual.rbcs);
    renderPlatelets(refs.plateletGroup, plateletEls, visual.platelets, visual.hoveredId);
  };
}
