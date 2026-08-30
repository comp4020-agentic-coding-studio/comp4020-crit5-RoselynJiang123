// Visual constants for CLOT / FLOW rendering. Pure data — no DOM, no game
// rules. Imported by src/game/render.ts and src/pages/index.astro so every
// art-direction change happens in one file. See CLAUDE.md "Architecture
// (locked)": this module must stay free of rendering logic, same as
// src/game/rules.ts must stay free of DOM.

// ---------- stage geometry ----------
export const VIEW_W = 1600;
export const VIEW_H = 900;

// The visual reference's demo canvas is 600x300. Its geometry (wobble
// amplitudes, stroke widths, gaussian spreads) is specified in that space;
// these factors carry it into our actual 1600x900 viewBox without hand
// re-deriving every constant. X-direction quantities (things measured along
// the flow axis: gaussian spreads, breach half-widths) scale by REF_SCALE_X;
// Y-direction quantities (heights, stroke widths, cell radii) scale by
// REF_SCALE_Y — the two differ because our viewBox isn't the same aspect
// ratio as the reference's.
export const REF_SCALE_X = VIEW_W / 600;
export const REF_SCALE_Y = VIEW_H / 300;

// ---------- vessel lumen (sampled sine curves, not hand-written beziers) ----------
// Sampling these functions into a polyline — instead of hand-writing bezier
// wall paths — guarantees the drawn wall and the cells' vertical containment
// bounds are the same curve. See CLOT-FLOW visual reference, Plate 04.
export const LUMEN_TOP_CENTER = 82 * REF_SCALE_Y;
export const LUMEN_BOTTOM_CENTER = 200 * REF_SCALE_Y;
export const LUMEN_WOBBLE_AMPLITUDE = 9 * REF_SCALE_Y;
export const LUMEN_TOP_PHASE = 0.5;
export const LUMEN_BOTTOM_PHASE = 2.4;
// ~39% of VIEW_H — the clot-driven narrowing of this band is the player's
// only warning that the vessel is closing, so it must be visible at a glance.
export const LUMEN_HEIGHT = LUMEN_BOTTOM_CENTER - LUMEN_TOP_CENTER;
export const WALL_SAMPLE_STEP = 40; // ~40 samples across VIEW_W

export function gauss(d: number, s: number): number {
  return Math.exp(-(d * d) / (2 * s * s));
}

export function yTop(x: number): number {
  return LUMEN_TOP_CENTER + LUMEN_WOBBLE_AMPLITUDE * Math.sin((x / VIEW_W) * 2 * Math.PI + LUMEN_TOP_PHASE);
}
export function yBot(x: number): number {
  return LUMEN_BOTTOM_CENTER + LUMEN_WOBBLE_AMPLITUDE * Math.sin((x / VIEW_W) * 2 * Math.PI + LUMEN_BOTTOM_PHASE);
}

export function wallSegment(fn: (x: number) => number, x0: number, x1: number): string {
  const step = WALL_SAMPLE_STEP / 4;
  let d = `M${x0.toFixed(1)},${fn(x0).toFixed(1)}`;
  for (let x = x0 + step; x < x1; x += step) d += ` L${x.toFixed(1)},${fn(x).toFixed(1)}`;
  return d + ` L${x1.toFixed(1)},${fn(x1).toFixed(1)}`;
}

function sampledPath(fn: (x: number) => number): string {
  let d = `M0,${fn(0).toFixed(1)}`;
  for (let x = WALL_SAMPLE_STEP; x <= VIEW_W; x += WALL_SAMPLE_STEP) d += ` L${x},${fn(x).toFixed(1)}`;
  return d;
}

// Static geometry (the intact upper wall, and the full lumen fill outline)
// never changes at runtime, so it's computed once here rather than every
// frame. The lower wall gains a real gap once woundSize > 0 (Step 2), so it
// is recomputed per frame in the renderer instead of being a constant here.
export const WALL_TOP_PATH = sampledPath(yTop);
export const LUMEN_PATH = (() => {
  let d = `M0,${yTop(0).toFixed(1)}`;
  for (let x = WALL_SAMPLE_STEP; x <= VIEW_W; x += WALL_SAMPLE_STEP) d += ` L${x},${yTop(x).toFixed(1)}`;
  d += ` L${VIEW_W},${yBot(VIEW_W).toFixed(1)}`;
  for (let x = VIEW_W - WALL_SAMPLE_STEP; x >= 0; x -= WALL_SAMPLE_STEP) d += ` L${x},${yBot(x).toFixed(1)}`;
  return d + " Z";
})();

export const WOUND_X = VIEW_W / 2;
// Derived from yBot(WOUND_X) so the wound always sits exactly on the sampled
// lower wall curve, never independently placed.
export const WOUND_Y = yBot(WOUND_X);

// ---------- wound breach (a real gap in the lower wall) ----------
// The breach is a torn opening in the wall itself, not a shape drawn over an
// intact wall — its half-width shrinks toward 0 as woundSize heals, closing
// the actual gap rather than just fading a decal.
export const BREACH_HALF_MIN = 12 * REF_SCALE_X;
export const BREACH_HALF_GROWTH = 46 * REF_SCALE_X;

export type BreachGeom = { x0: number; x1: number; y0: number; y1: number; half: number };

export function breachGeom(woundSize: number): BreachGeom {
  const half = BREACH_HALF_MIN + BREACH_HALF_GROWTH * woundSize;
  const x0 = WOUND_X - half;
  const x1 = WOUND_X + half;
  return { x0, x1, y0: yBot(x0), y1: yBot(x1), half };
}

// Gaussian spreads for the clot's two effects on cell motion: how far its
// upward push (on the lower bound) and its upstream speed dip reach along x.
export const CLOT_PROFILE_SPREAD = 58 * REF_SCALE_X;
export const CONGESTION_SPREAD = 86 * REF_SCALE_X;
export const CONGESTION_STRENGTH = 0.7; // local speed dips to (1 - 0.7) at clot=1, x=WOUND_X

// ---------- red blood cells (foreground layer) ----------
// Haematocrit is ~45% — a vessel is packed with cells that jostle each
// other. Overlap is intentionally allowed: no collision detection, that IS
// what blood looks like. See CLOT-FLOW visual reference, Plate 02.
export const RBC_MAX = 90;
export const RBC_BASE_SPEED = 260;
export const RBC_SPAWN_INTERVAL = 0.12;
// Biconcave-disc read: an off-centre radial gradient (see the "rbc" gradient
// in index.astro) plus a flattened ellipse. rx/ry ratio and per-cell rotation
// and size variance are what sell the disc — see CLOT-FLOW visual reference.
export const RBC_BASE_RY = 6.5; // ±15% variance keeps ry within ~5.5–7.5
export const RBC_RX_RATIO = 1.15;
export const RBC_SIZE_VARIANCE = 0.15; // ±15%, assigned once at spawn

// Hard cap across every RBC layer combined (foreground + background), so a
// slow tab / low framerate can never accumulate past a bounded ellipse count.
export const RBC_TOTAL_CAP = 140;

// ---------- red blood cells (background layer, depth) ----------
// Depth reads through size, brightness and speed alone — no blur filter is
// applied to this (or any) per-frame-moving layer. Background count is
// derived from the cap so foreground + background can never exceed it.
export const RBC_BACK_MAX = RBC_TOTAL_CAP - RBC_MAX;
export const RBC_BACK_SCALE = 0.6;
export const RBC_BACK_OPACITY = 0.38;
export const RBC_BACK_SPEED_FACTOR = 0.55;
export const COLOR_RBC_BACK_NEAR = "#7a3034";
export const COLOR_RBC_BACK_FAR = "#3f1015";

// ---------- platelets ----------
export const PLATELET_MAX_DRIFTING = 4;
export const PLATELET_BASE_SPEED = 90;
export const PLATELET_HIT_RADIUS = 34;

// Body scale is independent of PLATELET_HIT_RADIUS (constraint: never change
// hit areas/drag behaviour) — chosen so the drawn blob keeps roughly the same
// footprint the old triangle had inside that same hit circle.
export const PLATELET_BASE_SCALE = 0.7;
export const PLATELET_HOVER_SCALE_MULT = 1.25;
export const PLATELET_HELD_SCALE_MULT = 1.4;

export const PLATELET_GLOW_BASE_RADIUS = 9;
export const PLATELET_GLOW_RADIUS_MULT = 1.2;
export const PLATELET_GLOW_OPACITY_BASE = 0.35;
export const PLATELET_GLOW_OPACITY_HOVER = 0.7;

// Once attached, individual platelet elements are hidden — they read
// visually as the platelet-pile blobs stacked at the wound instead. See
// "bind every visual to state": platelet pile count <- clot.
export const COLOR_PLATELET_ATTACHED = "#e6d4bb";
export const PLATELET_PILE_MAX = 10; // one blob per 0.1 clot
export const PLATELET_PILE_SCALE = 0.55;
export const PLATELET_PSEUDOPOD_COUNT = 3;
export const PLATELET_PSEUDOPOD_LEN = 5;

// ---------- timings ----------
export const GLIDE_DURATION = 0.15;
export const HINT_DURATION = 0.5;
export const HINT_AMPLITUDE = 26;

export const FIBRIN_MAX = 5;
export const DRIP_PERIOD = 1.2;
export const SEAL_FLASH_DURATION = 0.35;

// ---------- lumen colour ramp ----------
export const LUMEN_FULL: [number, number, number] = [184, 31, 46];
export const LUMEN_DEPLETED: [number, number, number] = [92, 68, 66];

// ---------- static SVG palette (src/pages/index.astro) ----------
export const COLOR_TISSUE_GLOW = "#ffd9a8";
export const COLOR_STAIN = "#5a0d14";
export const COLOR_SEAL_FLASH_STROKE = "#fff3d6";
export const COLOR_DRIP = "#8e1420";
export const COLOR_RBC_FALLBACK = "#c42b2b";

// Platelets read as the interactive object precisely because they are NOT
// red — keep them pale and warm, distinct from every red-cell colour above.
export const COLOR_PLATELET_BODY = "#f6e8d4";
export const COLOR_PLATELET_HALO = "#ffc794";

// Red-cell biconcave-disc gradient: off-centre origin + central pallor.
export const COLOR_RBC_CORE = "#d4696c";
export const COLOR_RBC_MID = "#a83036";
export const COLOR_RBC_RIM = "#7d1a20";

// Irregular cell blob, not a geometric triangle — see CLOT-FLOW visual
// reference, Plate 02.
export const PLATELET_SHAPE_PATH =
  "M-8.5,-2.5 C-8,-7 -3.5,-9.6 1,-8.8 C6,-8 9.2,-4.5 8.8,0.5 C8.4,5.6 4.5,8.8 -0.5,8.6 C-5.6,8.4 -9,5 -8.5,-2.5 Z";

export const TISSUE_ELLIPSE = { cx: 1250, cy: 450, rx: 380, ry: 260, opacity: 0.2 };

// ---------- idle hint / clot occlusion / seal flash / blood stain ----------
export const COLOR_IDLE_GLOW = "#ff5b5b";
export const IDLE_GLOW_RADIUS = 90;
export const COLOR_CLOT_BULGE = "#5c1b1b";
export const SEAL_FLASH_STROKE_WIDTH = 3;
export const STAIN_Y_OFFSET = 150;

// ---------- fibrin (radiating strands, static styling) ----------
export const COLOR_FIBRIN = "#f2d9c8";
export const FIBRIN_STROKE_WIDTH = 2.5;
export const FIBRIN_GROUP_OPACITY = 0.9;

// ---------- vessel wall (organic outline) ----------
// Background tissue reads as flesh, not empty space, only if it is dark and
// warm rather than pure black. See CLOT-FLOW visual reference, Plate 04.
export const COLOR_TISSUE_BG = "#1d1013";
export const COLOR_LUMEN_FILL = "#2b1418";
export const COLOR_WALL_STROKE = "#4a2126";
export const WALL_STROKE_WIDTH = 14 * REF_SCALE_Y;
export const COLOR_ENDOTHELIUM = "#c08287";
export const ENDOTHELIUM_STROKE_WIDTH = 1.2;
export const ENDOTHELIUM_OPACITY = 0.42;
export const COLOR_VIGNETTE = "#050203";
export const VIGNETTE_OPACITY = 0.7;

export const COLOR_BREACH_INTERIOR = "#140a0c";
export const COLOR_TORN_LIP = "#3b191d";
export const COLOR_BREACH_GLOW = "#ff7a63";
// Radius tracks the breach's own half-width directly, so the glow shrinks
// along with the closing gap rather than staying fixed while it heals.
export const BREACH_GLOW_RADIUS_RATIO = 1.4;
export const BREACH_GLOW_OPACITY_BASE = 0.35;
export const BREACH_GLOW_OPACITY_PULSE = 0.5;

// Pale seam across the narrowing gap as it heals — invisible on a fresh
// wound, most visible as woundSize approaches 0. See "bind every visual to
// state": pale healing seam <- 1 - woundSize.
export const COLOR_HEALING_SEAM = "#c08287";
export const HEALING_SEAM_STROKE_WIDTH = 2 * REF_SCALE_Y;

// ---------- bleeding (seeping plume + growing pool) ----------
// The pool's rx is driven directly by (1 - bloodVolume) — it IS the
// blood-loss gauge, so no numeric readout is ever drawn alongside it.
export const COLOR_PLUME_NEAR = "#7a1119";
export const COLOR_PLUME_FAR = "#5e0f16";
export const PLUME_MIN_REACH = 40;
export const PLUME_MAX_REACH = 260;
export const PLUME_MIN_WIDTH = 26;
export const PLUME_MAX_WIDTH = 40;
export const PLUME_LEAK_NORM = 0.35; // leak(state) value at which the plume is fully extended

export const COLOR_POOL = "#4d0c12";
export const POOL_BASE_RX = 22;
export const POOL_MAX_RX = 130;
export const POOL_RY = 24;
export const POOL_Y_OFFSET = 64;

// A couple of irregular droplets remain as secondary detail alongside the
// plume/pool — not the primary bleeding read any more.
export const DROPLET_MAX = 2;
