# Process overview

A reading-guide to how the work came together --- a map to your process, not an
essay about it. Markers read this file and follow its citations; they don't
trawl the repo for evidence you didn't point at, so if a moment mattered, cite
it.

This file is the shape; the course site's
[assessment page](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#what-you-submit)
is the requirement, and its
[word counts](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/topics/assessment/#word-counts)
cover every deliverable.

## What I built

I built **CLOT / FLOW**, a one-mechanic browser game about balancing clotting against blood flow. Dragging platelets onto a torn vessel reduces bleeding but narrows the lumen: too little ends in `BLEEDING`, too much in `BLOCKED`, and a well-sealed wound reaches `STABLE`. I separated rules from rendering so tests protected correctness while playtesting judged legibility.

## The moments that mattered

### 1. I turned the brief into a harness before building

The starter `CLAUDE.md` was generic, so I replaced it with project-specific constraints: no tutorial text, one drag mechanic, pure DOM-free rules, fixed marking viewports, and a scope ban. I committed the full design specification separately. This kept later agent prompts short and incremental.

Evidence: [`7728d94`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-RoselynJiang123/commit/7728d94), [`7a2b708`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-RoselynJiang123/commit/7a2b708).

### 2. Tests established the rule; play exposed the real failure

I tested the central trade-off: one platelet must both reduce leak and narrow lumen. After the first playable loop, tests were green, but play showed the vessel looked abstract, bleeding reduction and wound closure were unclear, and both failure states lacked readable warning. The magnetic snap felt acceptable, so I kept it and redirected the next pass toward visual cause-and-effect.

Evidence: [`38aa53c`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-RoselynJiang123/commit/38aa53c), [`6ed1b8f...88355b8`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-RoselynJiang123/compare/6ed1b8f...88355b8).

### 3. I translated "too abstract" into concrete visual specifications

For the art pass I used a loop of implementation → screenshot → diagnosis → specification → implementation. Instead of asking for "more realistic" graphics, I specified vessel walls, biconcave red cells, an irregular tear, larger platelets, fibrin strands, visible bleeding, and a clot built from placed platelets that grows into the lumen. Granular commits kept each decision inspectable and reversible.

Evidence: [`7c2ed29...ed6fce0`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-RoselynJiang123/compare/7c2ed29...ed6fce0).

## Before you ship

`pnpm check:evidence` verifies your citations resolve to real commits, that a
reflection entry the marker reads is in `reflections/`, and that your
`CLAUDE.md` is there --- before a marker ever opens the file. It checks that
your map is traceable, not that it is good: the marker judges whether your
small, deliberately chosen set of moments shows real judgement and reflection. A
green check is not a substitute for that curation.

Images aren't checked: unlike a citation whose SHA doesn't resolve, a broken
image is visible the moment this file is rendered on GitHub.
