// SVG rendering for CLOT / FLOW. Reads GameState and its selectors; never
// computes game rules itself. See CLAUDE.md "Architecture (locked)".

import {
  clamp01,
  leak,
  lumen,
  oxygen,
  flow,
  pulse,
  PLATELET_SPAWN,
  WOUND_INITIAL,
} from "./rules";
import type { GameState } from "./rules";
import {
  VIEW_W,
  VIEW_H,
  yTop,
  yBot,
  gauss,
  LUMEN_HEIGHT,
  CLOT_PROFILE_SPREAD,
  CONGESTION_SPREAD,
  CONGESTION_STRENGTH,
  WOUND_X,
  WOUND_Y,
  RBC_MAX,
  RBC_BASE_SPEED,
  RBC_SPAWN_INTERVAL,
  PLATELET_MAX_DRIFTING,
  PLATELET_BASE_SPEED,
  PLATELET_HIT_RADIUS,
  GLIDE_DURATION,
  HINT_DURATION,
  HINT_AMPLITUDE,
  FIBRIN_MAX,
  DRIP_PERIOD,
  SEAL_FLASH_DURATION,
  LUMEN_FULL,
  LUMEN_DEPLETED,
  RBC_BASE_RY,
  RBC_RX_RATIO,
  RBC_SIZE_VARIANCE,
  RBC_BACK_MAX,
  RBC_BACK_SCALE,
  RBC_BACK_OPACITY,
  RBC_BACK_SPEED_FACTOR,
  PLUME_MIN_REACH,
  PLUME_MAX_REACH,
  PLUME_MIN_WIDTH,
  PLUME_MAX_WIDTH,
  PLUME_LEAK_NORM,
  POOL_BASE_RX,
  POOL_MAX_RX,
  POOL_RY,
  POOL_Y_OFFSET,
  DROPLET_MAX,
} from "../theme";

export const SVG_NS = "http://www.w3.org/2000/svg";

export { VIEW_W, VIEW_H, WOUND_X, WOUND_Y, PLATELET_HIT_RADIUS };

let rbcIdSeq = 0;
let plateletIdSeq = 0;

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}

// y is not stored: it is derived every frame from x, u and the current clot
// profile, so the drawn cell and its containment bounds can never drift
// apart. u is the cell's fixed fraction of the way from the lumen's top bound
// to its (clot-raised) bottom bound, assigned once at spawn.
export type RBC = {
  id: number;
  x: number;
  u: number;
  rotation: number;
  rx: number;
  ry: number;
};

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

export type Fibrin = { angleA: number; angleB: number; bow: number };

export type VisualState = {
  rbcs: RBC[];
  rbcsBack: RBC[];
  platelets: Platelet[];
  fibrin: Fibrin[];
  hoveredId: number | null;
  rbcSpawnT: number;
  rbcBackSpawnT: number;
  plateletSpawnT: number;
  hintActive: boolean;
  hintT: number;
  hintTargetId: number | null;
  bloodStain: number;
  sealFlashActive: boolean;
  sealFlashT: number;
};

export function createVisualState(): VisualState {
  return {
    rbcs: [],
    rbcsBack: [],
    platelets: [],
    fibrin: [],
    hoveredId: null,
    rbcSpawnT: 0,
    rbcBackSpawnT: 0,
    plateletSpawnT: 0,
    hintActive: false,
    hintT: 0,
    hintTargetId: null,
    bloodStain: 0,
    sealFlashActive: false,
    sealFlashT: 0,
  };
}

// Upstream congestion is a local speed field, not a fixed queue zone: cells
// bunch up on their own wherever the gaussian dip (centred on the wound)
// currently reaches, so it shrinks and moves exactly as the clot does.
function congestionSlow(x: number, clot: number): number {
  return 1 - CONGESTION_STRENGTH * clot * gauss(x - WOUND_X, CONGESTION_SPREAD);
}

export function stepRBCs(visual: VisualState, gameState: GameState, dt: number) {
  const f = flow(gameState);
  const speed = RBC_BASE_SPEED * (0.15 + 0.85 * f);
  const targetCount = Math.round(RBC_MAX * clamp01(0.15 + 0.85 * gameState.bloodVolume));

  visual.rbcSpawnT += dt;
  while (visual.rbcSpawnT >= RBC_SPAWN_INTERVAL && visual.rbcs.length < targetCount) {
    visual.rbcSpawnT -= RBC_SPAWN_INTERVAL;
    const variance = 1 + (Math.random() * 2 - 1) * RBC_SIZE_VARIANCE;
    const ry = RBC_BASE_RY * variance;
    visual.rbcs.push({
      id: rbcIdSeq++,
      x: -20,
      u: Math.random(),
      rotation: Math.random() * 180,
      rx: ry * RBC_RX_RATIO,
      ry,
    });
  }

  for (const rbc of visual.rbcs) {
    rbc.x += speed * congestionSlow(rbc.x, gameState.clot) * dt;
  }
  visual.rbcs = visual.rbcs.filter((r) => r.x <= VIEW_W + 20);
}

// Background depth layer: smaller, dimmer, slower — driven by the same
// flow(state) signal as the foreground so the "flow is slowing" cue reads at
// both depths, never a fixed-duration animation. See CLAUDE.md and
// CLOT-FLOW visual reference, Plate 03.
export function stepRBCsBack(visual: VisualState, gameState: GameState, dt: number) {
  const f = flow(gameState);
  const speed = RBC_BASE_SPEED * RBC_BACK_SPEED_FACTOR * (0.15 + 0.85 * f);
  const targetCount = Math.round(RBC_BACK_MAX * clamp01(0.15 + 0.85 * gameState.bloodVolume));

  visual.rbcBackSpawnT += dt;
  while (visual.rbcBackSpawnT >= RBC_SPAWN_INTERVAL && visual.rbcsBack.length < targetCount) {
    visual.rbcBackSpawnT -= RBC_SPAWN_INTERVAL;
    const variance = 1 + (Math.random() * 2 - 1) * RBC_SIZE_VARIANCE;
    const ry = RBC_BASE_RY * RBC_BACK_SCALE * variance;
    visual.rbcsBack.push({
      id: rbcIdSeq++,
      x: -20,
      u: Math.random(),
      rotation: Math.random() * 180,
      rx: ry * RBC_RX_RATIO,
      ry,
    });
  }

  for (const rbc of visual.rbcsBack) {
    rbc.x += speed * congestionSlow(rbc.x, gameState.clot) * dt;
  }
  visual.rbcsBack = visual.rbcsBack.filter((r) => r.x <= VIEW_W + 20);
}

export function stepPlateletsDrift(visual: VisualState, dt: number) {
  visual.plateletSpawnT += dt;
  const driftingCount = visual.platelets.filter((p) => p.state === "drifting").length;
  if (visual.plateletSpawnT >= PLATELET_SPAWN && driftingCount < PLATELET_MAX_DRIFTING) {
    visual.plateletSpawnT = 0;
    const spawnX = -20;
    visual.platelets.push({
      id: plateletIdSeq++,
      x: spawnX,
      y: yTop(spawnX) + 24 + Math.random() * (yBot(spawnX) - yTop(spawnX) - 48),
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

export function stepBloodStain(visual: VisualState, gameState: GameState, dt: number) {
  const l = leak(gameState);
  visual.bloodStain = clamp01(visual.bloodStain + l * 0.7 * dt - 0.06 * dt);
}

export function triggerSealFlash(visual: VisualState) {
  visual.sealFlashActive = true;
  visual.sealFlashT = 0;
}

export function stepSealFlash(visual: VisualState, dt: number) {
  if (!visual.sealFlashActive) return;
  visual.sealFlashT += dt;
  if (visual.sealFlashT >= SEAL_FLASH_DURATION) {
    visual.sealFlashActive = false;
    visual.sealFlashT = 0;
  }
}

export function addFibrinFor(visual: VisualState) {
  if (visual.fibrin.length >= FIBRIN_MAX) return;
  const angleA = Math.random() * Math.PI * 2;
  const angleB = angleA + Math.PI + (Math.random() - 0.5) * 1.1;
  visual.fibrin.push({ angleA, angleB, bow: (Math.random() - 0.5) * 22 });
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
  lumen: SVGPathElement;
  tissue: SVGEllipseElement;
  woundTear: SVGGElement;
  clotBulge: SVGCircleElement;
  fibrinGroup: SVGGElement;
  dripGroup: SVGGElement;
  bleedPlume: SVGPathElement;
  bleedPool: SVGEllipseElement;
  rbcBackGroup: SVGGElement;
  rbcGroup: SVGGElement;
  plateletGroup: SVGGElement;
  idleGlow: SVGCircleElement;
  sealFlash: SVGCircleElement;
  bloodStain: SVGCircleElement;
};

// Irregular droplets are a minor secondary detail now — the plume and pool
// carry the primary bleeding read. See CLOT-FLOW visual reference, Plate 05.
function renderDrips(
  group: SVGGElement,
  els: SVGEllipseElement[],
  leakValue: number,
  elapsed: number,
) {
  const count = Math.round(clamp01(leakValue / 0.5) * DROPLET_MAX);
  while (els.length < count) {
    const c = document.createElementNS(SVG_NS, "ellipse");
    c.setAttribute("rx", "3");
    c.setAttribute("ry", "5");
    group.appendChild(c);
    els.push(c);
  }
  while (els.length > count) {
    const c = els.pop()!;
    c.remove();
  }
  els.forEach((c, i) => {
    const t = (elapsed / DRIP_PERIOD + i * 0.35) % 1;
    c.setAttribute("cx", String(WOUND_X - 14 + i * 28));
    c.setAttribute("cy", String(WOUND_Y + 15 + t * 140));
    c.setAttribute("opacity", String(clamp01(1 - t)));
  });
}

// A seeping plume opening downward from the wound — width and reach both
// track leak(state) every frame, never a fixed-duration animation.
function renderPlume(el: SVGPathElement, leakValue: number) {
  const t = clamp01(leakValue / PLUME_LEAK_NORM);
  const reach = PLUME_MIN_REACH + (PLUME_MAX_REACH - PLUME_MIN_REACH) * t;
  const width = PLUME_MIN_WIDTH + (PLUME_MAX_WIDTH - PLUME_MIN_WIDTH) * t;
  const x = WOUND_X;
  const y = WOUND_Y;
  const d =
    `M ${x - width * 0.15} ${y} ` +
    `C ${x - width * 0.5} ${y + reach * 0.25} ${x - width * 0.35} ${y + reach * 0.7} ${x} ${y + reach} ` +
    `C ${x + width * 0.35} ${y + reach * 0.7} ${x + width * 0.5} ${y + reach * 0.25} ${x + width * 0.15} ${y} Z`;
  el.setAttribute("d", d);
  el.setAttribute("opacity", (0.25 + 0.75 * t).toFixed(3));
}

// The pool IS the blood-loss gauge — its rx is driven directly by
// (1 - bloodVolume), so no numeric blood-loss readout is ever needed.
function renderPool(el: SVGEllipseElement, bloodVolume: number) {
  const lost = clamp01(1 - bloodVolume);
  el.setAttribute("cx", String(WOUND_X));
  el.setAttribute("cy", String(WOUND_Y + POOL_Y_OFFSET));
  el.setAttribute("rx", (POOL_BASE_RX + (POOL_MAX_RX - POOL_BASE_RX) * lost).toFixed(2));
  el.setAttribute("ry", String(POOL_RY));
  el.setAttribute("opacity", (0.35 + 0.55 * lost).toFixed(3));
}

function renderFibrin(group: SVGGElement, els: SVGPathElement[], fibrin: Fibrin[], woundR: number) {
  while (els.length < fibrin.length) {
    const p = document.createElementNS(SVG_NS, "path");
    group.appendChild(p);
    els.push(p);
  }
  const rEdge = woundR * 0.95;
  fibrin.forEach((f, i) => {
    const el = els[i];
    const x1 = WOUND_X + Math.cos(f.angleA) * rEdge;
    const y1 = WOUND_Y + Math.sin(f.angleA) * rEdge;
    const x2 = WOUND_X + Math.cos(f.angleB) * rEdge;
    const y2 = WOUND_Y + Math.sin(f.angleB) * rEdge;
    const mid = (f.angleA + f.angleB) / 2;
    const mx = (x1 + x2) / 2 + Math.cos(mid + Math.PI / 2) * f.bow;
    const my = (y1 + y2) / 2 + Math.sin(mid + Math.PI / 2) * f.bow;
    el.setAttribute("d", `M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`);
  });
}

// Vertical placement comes straight from the same sampled curves the wall is
// drawn from, plus the clot's gaussian upward push on the lower bound — never
// a sine wobble independent of the wall. clotHeight is (1 - lumen(state)) *
// LUMEN_HEIGHT, i.e. read from the rules selector, not recomputed here.
function renderRBCs(
  group: SVGGElement,
  els: Map<number, SVGEllipseElement>,
  rbcs: RBC[],
  clotHeight: number,
  gradientId: string = "rbc",
  opacity: number | null = null,
) {
  const seen = new Set<number>();
  for (const rbc of rbcs) {
    seen.add(rbc.id);
    let el = els.get(rbc.id);
    if (!el) {
      el = document.createElementNS(SVG_NS, "ellipse");
      el.setAttribute("rx", String(rbc.rx));
      el.setAttribute("ry", String(rbc.ry));
      el.setAttribute("fill", `url(#${gradientId})`);
      if (opacity !== null) el.setAttribute("opacity", String(opacity));
      group.appendChild(el);
      els.set(rbc.id, el);
    }
    const top = yTop(rbc.x) + rbc.ry;
    const bot = yBot(rbc.x) - rbc.ry - clotHeight * gauss(rbc.x - WOUND_X, CLOT_PROFILE_SPREAD);
    const span = Math.max(rbc.ry, bot - top);
    const cx = rbc.x;
    const cy = top + rbc.u * span;
    el.setAttribute("cx", String(cx));
    el.setAttribute("cy", String(cy));
    el.setAttribute("transform", `rotate(${rbc.rotation} ${cx} ${cy})`);
  }
  for (const [id, el] of els) {
    if (!seen.has(id)) {
      el.remove();
      els.delete(id);
    }
  }
}

type PlateletEls = { hit: SVGCircleElement; group: SVGGElement; halo: SVGCircleElement };

function renderPlatelets(
  group: SVGGElement,
  els: Map<number, PlateletEls>,
  platelets: Platelet[],
  hoveredId: number | null,
  hintTargetId: number | null,
  hintEnvelope: number,
) {
  const seen = new Set<number>();
  for (const p of platelets) {
    seen.add(p.id);
    let entry = els.get(p.id);
    if (!entry) {
      const hit = document.createElementNS(SVG_NS, "circle");
      hit.setAttribute("r", String(PLATELET_HIT_RADIUS));
      hit.setAttribute("class", "platelet-hit");
      const g = document.createElementNS(SVG_NS, "g");
      g.setAttribute("class", "platelet-visual");
      const halo = document.createElementNS(SVG_NS, "circle");
      halo.setAttribute("r", "2.4");
      halo.setAttribute("class", "platelet-halo");
      const use = document.createElementNS(SVG_NS, "use");
      use.setAttribute("href", "#platelet-shape");
      use.setAttribute("class", "platelet-body-shape");
      g.appendChild(halo);
      g.appendChild(use);
      group.appendChild(hit);
      group.appendChild(g);
      entry = { hit, group: g, halo };
      els.set(p.id, entry);
    }

    entry.hit.setAttribute("cx", String(p.x));
    entry.hit.setAttribute("cy", String(p.y));
    entry.hit.setAttribute("pointer-events", p.state === "drifting" ? "auto" : "none");

    const hovered = hoveredId === p.id && p.state === "drifting";
    const scale = p.state === "held" ? 7.5 : hovered ? 6.8 : 6;
    entry.group.setAttribute("transform", `translate(${p.x},${p.y}) scale(${scale})`);
    entry.group.setAttribute("opacity", p.state === "attached" ? "0" : "1");

    let haloOpacity = p.state === "held" ? 0.55 : hovered ? 0.4 : 0.15;
    if (p.id === hintTargetId) haloOpacity = Math.max(haloOpacity, 0.65 * hintEnvelope);
    entry.halo.setAttribute("opacity", haloOpacity.toFixed(3));
  }
  for (const [id, entry] of els) {
    if (!seen.has(id)) {
      entry.hit.remove();
      entry.group.remove();
      els.delete(id);
    }
  }
}

export function createRenderer(refs: Refs) {
  const rbcBackEls = new Map<number, SVGEllipseElement>();
  const rbcEls = new Map<number, SVGEllipseElement>();
  const plateletEls = new Map<number, PlateletEls>();
  const fibrinEls: SVGPathElement[] = [];
  const dripEls: SVGEllipseElement[] = [];

  return function render(gameState: GameState, visual: VisualState) {
    const bloodVol = clamp01(gameState.bloodVolume);
    const lumenValue = lumen(gameState);
    const occlusion = clamp01(1 - lumenValue);
    const leakValue = leak(gameState);
    const oxygenValue = clamp01(oxygen(gameState));
    const pulseValue = pulse(gameState.elapsed);
    const pulseWobble = (pulseValue - 1) * bloodVol;

    refs.lumen.setAttribute("fill", lerpColor(LUMEN_DEPLETED, LUMEN_FULL, bloodVol));
    refs.lumen.setAttribute(
      "opacity",
      clamp01((0.55 + 0.35 * bloodVol) * (1 + 0.12 * pulseWobble)).toFixed(3),
    );

    refs.tissue.setAttribute("opacity", (0.12 + 0.5 * oxygenValue).toFixed(3));

    const woundRatio = clamp01(gameState.woundSize / WOUND_INITIAL);
    const woundR = 9 + 46 * woundRatio;
    refs.woundTear.setAttribute(
      "transform",
      `translate(${WOUND_X},${WOUND_Y}) scale(${woundR.toFixed(2)})`,
    );

    refs.clotBulge.setAttribute("r", (6 + 78 * occlusion).toFixed(2));
    refs.clotBulge.setAttribute("opacity", (0.5 + 0.4 * occlusion).toFixed(3));

    const hintEnvelope = visual.hintActive
      ? Math.sin(clamp01(visual.hintT / HINT_DURATION) * Math.PI)
      : 0;
    refs.idleGlow.setAttribute("opacity", (0.5 * hintEnvelope).toFixed(3));

    if (visual.sealFlashActive) {
      const t = clamp01(visual.sealFlashT / SEAL_FLASH_DURATION);
      refs.sealFlash.setAttribute("r", (20 + 70 * t).toFixed(2));
      refs.sealFlash.setAttribute("opacity", ((1 - t) * 0.6).toFixed(3));
    } else {
      refs.sealFlash.setAttribute("opacity", "0");
    }

    refs.bloodStain.setAttribute("r", (30 + 60 * visual.bloodStain).toFixed(2));
    refs.bloodStain.setAttribute("opacity", (visual.bloodStain * 0.5).toFixed(3));

    renderDrips(refs.dripGroup, dripEls, leakValue, gameState.elapsed);
    renderPlume(refs.bleedPlume, leakValue);
    renderPool(refs.bleedPool, bloodVol);
    renderFibrin(refs.fibrinGroup, fibrinEls, visual.fibrin, woundR);
    const clotHeight = (1 - lumenValue) * LUMEN_HEIGHT;
    renderRBCs(refs.rbcBackGroup, rbcBackEls, visual.rbcsBack, clotHeight, "rbc-back", RBC_BACK_OPACITY);
    renderRBCs(refs.rbcGroup, rbcEls, visual.rbcs, clotHeight);
    renderPlatelets(
      refs.plateletGroup,
      plateletEls,
      visual.platelets,
      visual.hoveredId,
      visual.hintTargetId,
      hintEnvelope,
    );
  };
}
