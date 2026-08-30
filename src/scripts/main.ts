import {
  addPlatelet,
  createInitialState,
  flowScore,
  updateGame,
} from "../game/rules";
import type { GameState } from "../game/rules";
import {
  addFibrinFor,
  createRenderer,
  createVisualState,
  stepAttaching,
  stepBloodStain,
  stepPlateletsDrift,
  stepRBCs,
  stepRBCsBack,
  stepSealFlash,
  triggerIdleHint,
  triggerSealFlash,
  WOUND_X,
  WOUND_Y,
} from "../game/render";
import type { Refs, VisualState } from "../game/render";
import { attachDragHandlers } from "../game/drag";

function need<T extends Element>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el as unknown as T;
}

const svg = need<SVGSVGElement>("game");
const refs: Refs = {
  lumen: need<SVGPathElement>("vessel-lumen"),
  tissue: need<SVGEllipseElement>("tissue"),
  wallBottomLeft: need<SVGPathElement>("wall-bottom-left"),
  wallBottomRight: need<SVGPathElement>("wall-bottom-right"),
  endoBottomLeft: need<SVGPathElement>("endo-bottom-left"),
  endoBottomRight: need<SVGPathElement>("endo-bottom-right"),
  breachInterior: need<SVGPathElement>("breach-interior"),
  breachLipLeft: need<SVGPathElement>("breach-lip-left"),
  breachLipRight: need<SVGPathElement>("breach-lip-right"),
  breachGlow: need<SVGCircleElement>("breach-glow"),
  healingSeam: need<SVGPathElement>("healing-seam"),
  clotBulge: need<SVGCircleElement>("clot-bulge"),
  fibrinGroup: need<SVGGElement>("fibrin-group"),
  dripGroup: need<SVGGElement>("drip-group"),
  bleedPlume: need<SVGPathElement>("bleed-plume"),
  bleedPool: need<SVGEllipseElement>("bleed-pool"),
  rbcBackGroup: need<SVGGElement>("rbc-back-group"),
  rbcGroup: need<SVGGElement>("rbc-group"),
  plateletGroup: need<SVGGElement>("platelet-group"),
  idleGlow: need<SVGCircleElement>("idle-glow"),
  sealFlash: need<SVGCircleElement>("seal-flash"),
  bloodStain: need<SVGCircleElement>("blood-stain"),
};
const titleEl = need<HTMLElement>("title");
const overlayEl = need<HTMLElement>("outcome-overlay");
const outcomeWordEl = need<HTMLElement>("outcome-word");
const outcomeScoreEl = need<HTMLElement>("outcome-score");
const resetBtn = need<HTMLButtonElement>("reset-btn");

const render = createRenderer(refs);

let gameState: GameState = createInitialState();
let visual: VisualState = createVisualState();
let hasInteracted = false;
let paused = false;
let lastFrameTime = 0;
let lastHintAt = performance.now();
let audioCtx: AudioContext | null = null;

function ensureAudio() {
  if (!audioCtx) audioCtx = new AudioContext();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

function playAttachSound() {
  if (!audioCtx) return;
  const ctx = audioCtx;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(660, now);
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(0.15, now + 0.012);
  gain.gain.linearRampToValueAtTime(0, now + 0.09);
  osc.connect(gain).connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.1);
}

function onFirstInteraction() {
  if (hasInteracted) return;
  hasInteracted = true;
  ensureAudio();
  titleEl.classList.remove("flash-in");
  titleEl.classList.add("fade-out");
}

attachDragHandlers({
  svg,
  getPlatelets: () => visual.platelets,
  woundX: WOUND_X,
  woundY: WOUND_Y,
  onFirstInteraction,
  setHover: (id) => {
    visual.hoveredId = id;
  },
});

const OUTCOME_WORDS: Record<string, string> = {
  stable: "STABLE",
  bleeding: "BLEEDING",
  blocked: "BLOCKED",
};

function showOutcome(outcome: string, score: number) {
  outcomeWordEl.textContent = OUTCOME_WORDS[outcome] ?? "";
  outcomeScoreEl.textContent = `FLOW ${score}%`;
  overlayEl.classList.add("visible");
}

function resetGame() {
  gameState = createInitialState();
  visual = createVisualState();
  hasInteracted = false;
  paused = false;
  lastHintAt = performance.now();
  overlayEl.classList.remove("visible");
  titleEl.classList.remove("fade-out");
  void titleEl.offsetWidth; // restart the flash-in animation
  titleEl.classList.add("flash-in");
}

resetBtn.addEventListener("click", resetGame);

titleEl.classList.add("flash-in");

function frame(t: number) {
  if (!lastFrameTime) lastFrameTime = t;
  const dt = Math.min(0.05, (t - lastFrameTime) / 1000);
  lastFrameTime = t;

  if (!paused) {
    gameState = updateGame(gameState, dt);
    stepRBCs(visual, gameState, dt);
    stepRBCsBack(visual, gameState, dt);
    stepPlateletsDrift(visual, dt);
    const completed = stepAttaching(visual, dt);
    for (const _id of completed) {
      gameState = addPlatelet(gameState);
      addFibrinFor(visual);
      triggerSealFlash(visual);
      playAttachSound();
    }
    stepBloodStain(visual, gameState, dt);
    stepSealFlash(visual, dt);

    if (!hasInteracted && performance.now() - lastHintAt > 5000) {
      triggerIdleHint(visual);
      lastHintAt = performance.now();
    }

    if (gameState.outcome !== "playing") {
      paused = true;
      showOutcome(gameState.outcome, flowScore(gameState));
    }
  }

  render(gameState, visual);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
