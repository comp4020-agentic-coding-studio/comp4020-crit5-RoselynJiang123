// Pure CLOT / FLOW rule model. No DOM, no SVG, no timers, no rendering.
// See CLOT-FLOW-SPEC.md §2 for the authoritative definition.

export type Outcome = "playing" | "stable" | "bleeding" | "blocked";

export type GameState = {
  clot: number;
  woundSize: number;
  bloodVolume: number;
  elapsed: number;
  oxygenIntegral: number;
  outcome: Outcome;
};

export const WOUND_INITIAL = 0.5;
export const BLOOD_INITIAL = 1.0;
export const PLATELET_SIZE = 0.1;
export const LUMEN_COST = 0.9;
export const LUMEN_MIN = 0.25;
export const BLEED_RATE = 0.066;
export const HEAL_MAX = 0.03;
export const HEAL_LEAK_TOL = 0.02;
export const LYSIS_BASE = 0.015;
export const PULSE_PERIOD = 4.0;
export const PULSE_AMP_START = 0.3;
export const PULSE_AMP_END = 1.5;
export const PULSE_RAMP = 90;
export const PLATELET_SPAWN = 1.0;

export function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function createInitialState(): GameState {
  return {
    clot: 0,
    woundSize: WOUND_INITIAL,
    bloodVolume: BLOOD_INITIAL,
    elapsed: 0,
    oxygenIntegral: 0,
    outcome: "playing",
  };
}

export function leak(s: GameState): number {
  return Math.max(0, s.woundSize - s.clot);
}

export function lumen(s: GameState): number {
  return clamp01(1 - s.clot * LUMEN_COST);
}

export function flow(s: GameState): number {
  return lumen(s) ** 2;
}

export function oxygen(s: GameState): number {
  return flow(s) * s.bloodVolume;
}

export function sealQ(s: GameState): number {
  return clamp01(1 - leak(s) / HEAL_LEAK_TOL);
}

export function pulse(t: number): number {
  const amp = lerp(PULSE_AMP_START, PULSE_AMP_END, clamp01(t / PULSE_RAMP));
  return 1 + amp * Math.max(0, Math.sin((2 * Math.PI * t) / PULSE_PERIOD)) ** 3;
}

export function addPlatelet(s: GameState): GameState {
  return { ...s, clot: s.clot + PLATELET_SIZE };
}

export function evaluateOutcome(s: GameState): Outcome {
  if (s.woundSize <= 0) return "stable";
  if (s.bloodVolume <= 0) return "bleeding";
  if (lumen(s) <= LUMEN_MIN) return "blocked";
  return "playing";
}

export function updateGame(s: GameState, dt: number): GameState {
  if (s.outcome !== "playing") return s;

  const next: GameState = {
    clot: Math.max(
      0,
      s.clot - LYSIS_BASE * (0.3 + 0.7 * flow(s)) * pulse(s.elapsed) * dt,
    ),
    woundSize: s.woundSize - HEAL_MAX * oxygen(s) * sealQ(s) * dt,
    bloodVolume: s.bloodVolume - leak(s) * BLEED_RATE * dt,
    elapsed: s.elapsed + dt,
    oxygenIntegral: s.oxygenIntegral + oxygen(s) * dt,
    outcome: s.outcome,
  };
  next.outcome = evaluateOutcome(next);
  return next;
}

export function flowScore(s: GameState): number {
  return Math.round((100 * s.oxygenIntegral) / s.elapsed);
}
