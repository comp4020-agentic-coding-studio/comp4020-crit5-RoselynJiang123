import { describe, expect, it } from "vitest";
import {
  addPlatelet,
  createInitialState,
  evaluateOutcome,
  leak,
  lumen,
  updateGame,
} from "./rules";

describe("clot-flow rules", () => {
  it("a platelet reduces the leak and narrows the lumen at the same time", () => {
    const before = createInitialState();
    const after = addPlatelet(before);
    expect(leak(after)).toBeLessThan(leak(before));
    expect(lumen(after)).toBeLessThan(lumen(before));
  });

  it("ends as bleeding when the wound is left untreated", () => {
    let s = createInitialState();
    for (let i = 0; i < 60 * 60; i++) s = updateGame(s, 1 / 60);
    expect(s.outcome).toBe("bleeding");
  });

  it("ends as blocked when too many platelets are placed", () => {
    let s = createInitialState();
    for (let i = 0; i < 12; i++) s = addPlatelet(s);
    expect(evaluateOutcome(s)).toBe("blocked");
  });
});
