# Crit 5 Reflection

The biggest shift for me this week was realising that a game can be technically correct and still fail completely as an interaction.

My first playable version passed every automated test. The rules behaved exactly as intended: adding a platelet reduced bleeding while also narrowing the vessel, and the game could end in STABLE, BLEEDING or BLOCKED. But when I actually played it, the important information was not readable. The vessel looked like an abstract bar, the wound did not clearly look injured, and the visual warnings for both failure states were too weak. The tests protected the rule, but not whether the player could see that rule happening.

The no-tutorial constraint made this much more obvious. Removing instructions does not remove the need to teach; it transfers that responsibility to shape, motion, timing and feedback. A platelet that is too small, a clot that looks like a dark hole, or blood flow that does not visibly slow are therefore not just visual problems. They are gameplay problems.

I also changed how I directed coding agents. "Make it look more like a blood vessel" was not a useful instruction. I had to turn judgement into specific constraints: vessel-wall structure, cell proportions, wound shape, clot direction and state-driven visual changes.

This week made me want to work less like someone who only verifies that software functions, and more like someone who builds a harness for both correctness and human interpretation.
