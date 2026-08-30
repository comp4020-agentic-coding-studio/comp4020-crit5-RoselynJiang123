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

// ---------- red blood cells ----------
export const RBC_MAX = 40;
export const RBC_BASE_SPEED = 260;
export const RBC_SPAWN_INTERVAL = 0.12;
export const RBC_QUEUE_ZONE = 220;
// Biconcave-disc read: an off-centre radial gradient (see the "rbc" gradient
// in index.astro) plus a flattened ellipse. rx/ry ratio and per-cell rotation
// and size variance are what sell the disc — see CLOT-FLOW visual reference.
export const RBC_BASE_RY = 6;
export const RBC_RX_RATIO = 1.15;
export const RBC_SIZE_VARIANCE = 0.15; // ±15%, assigned once at spawn

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
export const COLOR_BG = "#0a0203";
export const COLOR_WALL_TOP = "#7a2b30";
export const COLOR_WALL_BOTTOM = "#2f0f13";
export const COLOR_TISSUE_GLOW = "#ffd9a8";
export const COLOR_STAIN = "#5a0d14";
export const COLOR_LUMEN_RECT = "#8a1420";
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

export const VESSEL_WALL_PATH =
  "M 0,350 Q 200,335 400,350 T 800,350 T 1200,350 T 1600,350 L 1600,550 Q 1400,565 1200,550 T 800,550 T 400,550 T 0,550 Z";

export const VESSEL_LUMEN_RECT = { x: 40, y: 400, width: 1520, height: 100, rx: 30, opacity: 0.8 };

export const WOUND_TEAR_SCALE = 28;
