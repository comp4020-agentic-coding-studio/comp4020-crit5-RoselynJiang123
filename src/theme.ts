// Visual constants for CLOT / FLOW rendering. Pure data — no DOM, no game
// rules. Imported by src/game/render.ts and src/pages/index.astro so every
// art-direction change happens in one file. See CLAUDE.md "Architecture
// (locked)": this module must stay free of rendering logic, same as
// src/game/rules.ts must stay free of DOM.

// ---------- stage geometry ----------
export const VIEW_W = 1600;
export const VIEW_H = 900;

export const LUMEN_TOP = 400;
export const LUMEN_BOTTOM = 500;
export const WOUND_X = 800;
export const WOUND_Y = 450;

// ---------- red blood cells (foreground layer) ----------
// Haematocrit is ~45% — a vessel is packed with cells that jostle each
// other. Overlap is intentionally allowed: no collision detection, that IS
// what blood looks like. See CLOT-FLOW visual reference, Plate 02.
export const RBC_MAX = 90;
export const RBC_BASE_SPEED = 260;
export const RBC_SPAWN_INTERVAL = 0.12;
export const RBC_QUEUE_ZONE = 220;
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
export const COLOR_WOUND_DARK = "#3a0f14";
export const COLOR_WOUND_DARKEST = "#170305";
export const COLOR_SEAL_FLASH_STROKE = "#fff3d6";
export const COLOR_DRIP = "#8e1420";
export const COLOR_RBC_FALLBACK = "#c42b2b";

// Platelets read as the interactive object precisely because they are NOT
// red — keep them pale and warm, distinct from every red-cell colour above.
export const COLOR_PLATELET_BODY = "#f4e5d1";
export const COLOR_PLATELET_HALO = "#ffc794";

// Red-cell biconcave-disc gradient: off-centre origin + central pallor.
export const COLOR_RBC_CORE = "#d4696c";
export const COLOR_RBC_MID = "#a83036";
export const COLOR_RBC_RIM = "#7d1a20";

export const PLATELET_SHAPE_PATH =
  "M 1,0 L 0.35,0.606 L -0.525,0.909 L -0.75,0 L -0.55,-0.953 L 0.325,-0.563 Z";

export const TISSUE_ELLIPSE = { cx: 1250, cy: 450, rx: 380, ry: 260, opacity: 0.2 };

// ---------- vessel wall (organic outline) ----------
// Background tissue reads as flesh, not empty space, only if it is dark and
// warm rather than pure black. See CLOT-FLOW visual reference, Plate 04.
export const COLOR_TISSUE_BG = "#1d1013";
export const COLOR_LUMEN_FILL = "#2b1418";
export const COLOR_WALL_STROKE = "#4a2126";
export const WALL_STROKE_WIDTH = 13;
export const COLOR_ENDOTHELIUM = "#c08287";
export const ENDOTHELIUM_STROKE_WIDTH = 1.2;
export const ENDOTHELIUM_OPACITY = 0.42;
export const COLOR_VIGNETTE = "#050203";
export const VIGNETTE_OPACITY = 0.7;

// Gentle cubic-bezier curves, not straight lines — an artery wall is never
// perfectly parallel. Wobble is baked into these paths at build time (they
// are static geometry, not per-frame animation).
export const VESSEL_TOP_PATH =
  "M0,400 C320,388 533.3,412 800,400 C1066.7,388 1333.3,414 1600,400";
export const VESSEL_BOTTOM_PATH =
  "M0,500 C320,512 533.3,488 800,500 C1066.7,512 1333.3,488 1600,500";
export const VESSEL_LUMEN_PATH =
  `${VESSEL_TOP_PATH} L1600,500 C1333.3,488 1066.7,512 800,500 C533.3,488 320,512 0,500 Z`;

export const WOUND_TEAR_SCALE = 28;

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
