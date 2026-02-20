# The Story of JSHack

*A truthful account of how a roguelike got built, almost didn't, got rebuilt, almost didn't again, and came back different.*

---

## The Game That Arrived Already Assembled

October 15th, 2025. The first commit is called "init," which is the lie every project tells at its own birth. This wasn't a beginning — it was a reveal. The game arrived in the repository already breathing: an overworld with Perlin noise terrain, mountains clustered by noise function, water at the edges, grass shaded in subtle variations. Stairs that descend into dungeons. Fog of war. An inventory. Auto-pickup that persists between sessions. Game-over tombstones saved to localStorage. Fountains, altars, thrones, sinks, graves — all with basic interactions. Gold. Rings. A shield. Lightning that rendered as canvas glow lines with endpoint sparks instead of the ASCII characters everyone else used.

The README was polished. The philosophy was articulated: *hackable, transparent, fun.* Zero dependencies. No build step. Edit a file, hit refresh, see your changes. "This is JavaScript the way it was meant to be." The favicon was already a custom inline SVG.

Someone had been building this privately, getting it to a point they were proud of, and then decided to let it be a thing that exists in the world. The "init" commit is a door being opened, not a foundation being laid.

---

## The Decision

Two days later, at 12:48pm on a Friday, a commit message reads: *"moving to modular arch + ecs."*

The diff tells the story. The entire contents of `index.html` — three thousand lines of JavaScript, all of it working — gets moved to `reference-implementation.html`. Not deleted. Preserved. Then four new files appear: `src/ecs/core.js`, `src/ecs/archetype.js`, `src/ecs/hierarchy.js`, `src/ecs/serialization.js`. And a new `src/main.js`, one hundred and seven lines.

This is a developer who has been here before. They know what a 3,000-line monolith becomes in three months. They knew it on day two. The original is kept because you might need to look back at how something worked, but the architecture it represents is not the future. A new ECS foundation is built from scratch, cleanly, with the old thing still visible through the window for reference.

The discipline of that decision — to throw away working code in order to build the right thing — is the first sign of what this project actually is.

---

## The First Good Week

The ECS rebuild goes well. Player component, data scaffolding, archetypes: Explorer, Threat, WorldAnchor, Ephemeral. Projectile and lifetime systems wired in. Bresenham's line algorithm added early, because line-of-sight is coming and you want the math ready. Movement. Camera. The event bus.

On October 22nd, everything is working well enough that the developer can be playful. A "dumb nightly delight" gets committed: when gold is picked up, another gold coin spawns at a random location somewhere in the dungeon. No good reason for this. It made the developer laugh. It got committed. The commit message says as much: *"Dumb nightly delight: when gold is picked up, spawn another gold in a random location."* This is someone enjoying themselves.

That evening, the lighting starts.

---

## The First Trap

October 23rd. The commits tell the story without needing interpretation:

*"lighting early"* → *"shadows"* → *"smooth lighting"* → *"smoothing"* → *"tightening radial FOV"* → *"item shad opposite source"* → *"light-grid-update"* → *"wall-wall"*

Eight commits. One day. Every single one is about light. No gameplay was added. The game does not become more fun to play on October 23rd. But the lighting looks good.

October 24th: two commits called *"night-night."* The developer is working late. The lighting is consuming the nights. There are also commits called *"organizing"* and *"perf-test"* — the kind of commits that appear when you've been deep in something long enough that you need to tidy around yourself just to see straight.

The Ten Commandments document, which will be written five days later, names this date explicitly. *"Oct 23, 2025: 564 lines of lighting infrastructure in one evening."* The line count was remembered. These things leave marks.

---

## The Incident

October 25th is the most interesting day in the repository.

It starts productively. The dungeon generator appears: *"dungeon-gen-0."* Then *"d-gen-2"*. Then *"d-gen-3."* Then *"d-gen-4."* Then *"d-gen-5-tor."* Five iterations of the dungeon generator, each better than the last, across a single afternoon. This is good work. This is exactly what should be happening.

And then.

Fog of war. Combat basics. A target dummy. Hallucination mode (added and immediately disabled — *"disable hallu on start"* — it was too much). Float text with motion presets. Torches — emitter system, emitter wiring, emitter tweaks, then the torch archetype itself. Flickering improved. Darkening applied at distance. No light far away. Walls interacting with lights. Mobile device scaling. Pixelated rendering mode. Fog of war again. FOV toggle. A second renderer pass. Doors. ECS backport for doors. A wall-line renderer.

And then the commit messages start changing.

*"cb." "cb." "cb." "cb."*

Then:

*"a." "a." "a." "a." "a." "a."*

Six commits. All single letters. The developer is in a flow state. Something interesting is being solved. The problem is that the interesting thing being solved is an engine problem, not a game problem.

The Ten Commandments would later call this "the commit message canary." Commandment VI: *"When commit messages degrade to single letters, you are in a flow state solving the wrong problem. Stop. `git stash`. Walk away. Come back and ask: is this a game feature or an engine feature? If it's engine, kill it."*

The canary was singing. Nobody stopped.

October 26th: more single-letter commits.

---

## The Reset

Tuesday, October 28th, 5:50pm.

*"project reset, key concepts retained offline"*

159 files changed. 774 lines added. 12,924 lines deleted.

In the same push, two new files appear: `TEN_COMMANDMENTS.md` and `.github/custom-instructions.md` — the same content in both places, to make sure neither the repository nor any future AI assistant could miss it.

The Ten Commandments are forensic. They're not abstract principles — they're autopsies. Commandment II doesn't just say "don't build a lighting engine." It says: *"No raycasting. No shadow volumes. No specular fields. No emissive light polygons. No smooth glow renderers. If a file has 'kernel' in its name, delete it."* That level of specificity comes from knowing exactly how you fell down.

Commandment XI is the most honest:

> *"Oct 23, 2025: 564 lines of lighting infrastructure in one evening. Deleted 12,924 lines six days later. Nov 6, 2025: 921-line GeometryKernel reintroduced two days after the clean rebuild. Same mistake. Same rabbit hole. Different hat.*
>
> *If you are excited about the math, that is the warning sign."*

The November 6th date is in there as a prophecy, written before it had happened. Or as a warning, which amounted to the same thing.

---

## The Disciplined Rebuild

November 1st. The new codebase begins.

The difference from October is visible in the commit messages alone. *"actions + actionManager."* *"intent wiring 0."* *"item pickup/drop tests."* *"effects + tests."* The tests come with the systems. The Ten Commandments are being followed — not because someone is checking, but because the person who wrote them is the same person writing the code.

In four days, the project has more playable game than anything from October. Items, equipment, affixes, ScriptRef, creatures, intent wiring, auto-pickup with a chooser for when multiple items are stacked. Real commit messages. One system at a time.

The gold still spawns more gold when you pick it up. Some good ideas survive resets.

---

## The Second Trap

It happened on November 6th. The Ten Commandments document had already named the date, somehow.

The analytic dungeon kernel arrived. Continuous movement. Capsule collision. `Math.hypot`. A 921-line geometry system for a game in which positions are integers. Everything Commandments I, II, III, and IX explicitly forbid.

The project survived this time. The code got integrated, eventually became real features: multi-floor dungeons with portals, a demo scene that worked. By November 12th, the game had multiple floors and same-level teleportation. By November 15th, someone added a news section to the site.

Then the project went quiet for eighty-three days.

---

## The Winter

November 15th to February 7th. No commits. The code sat in the repository while something was presumably being figured out.

This kind of gap is hard to read from the outside. It could be burnout, or real life, or the project going dormant. But the February return suggests something different — that the time was being spent thinking rather than not thinking. The developer came back with sharper opinions, a different runtime, and a clearer picture of what the architecture needed to be.

The winter wasn't abandonment. It was incubation.

---

## The Return

February 7th, 2026. The first commit back is: *"bye bye node, hello deno."*

Deno, not Node, because Deno has a built-in test runner, a permission model, and a design philosophy that aligns with a project that cares about determinism and explicit dependencies. This wasn't an impulsive choice. Someone spent the winter deciding what runtime a test-driven, determinism-first roguelike should run on, and came back with an answer.

The archive was reopened. Everything was brought back over — combat, ranged weapons, spawners, items, affixes, spells, blastwave, meteor — but differently. Not ported wholesale. Rebuilt with the architecture that the winter had clarified.

Materials were removed on the first day back. *"bye bye materials."* They'd be back in a week, redesigned from scratch with material reaction profiles and conduction. The temporary removal was intentional — the old version wasn't worth porting, but the concept was.

---

## February

The month moved fast.

Gods arrived. A deity system with neglect counters and offerings and wrath. Kills became spiritual events. Hitting your pet angered the appropriate divine power.

A cat arrived. The cat had a state machine. The cat's deliveries appeared on visible, adjacent ground so you could find them. The cat could be on guard without consuming your turn. The eating-your-pet situation was handled.

Hunger. Stamina. An iron pickaxe. The first wand (Frost). A basic shop. Engravings you could carve into the floor. Ambient sound. Status effects: confused, weakened, poisoned. A Book of the Dead.

Material science came back bigger: reaction profiles, conductivity, resistance. Damage flowed through pipes. Stacking utilities. A plasma cloud VFX with a quad-bezier trajectory because the math was correct and the effect was worth having.

The Scroll of Homecoming arrived on February 17th and was immediately fixed five times. The first version did nothing. The second resolved before the anchor was ready. The third had the wrong depth. The fourth put the portal in the wrong location. The fifth one works: you use the scroll, you go home, a portal appears where you land so you can go back to where you were. Five commits, all honest, all named. This is what progress looks like in a codebase with real commit hygiene.

On February 18th, after a late session formalizing the architecture — mechanics in verb pipelines, behavior in data-space hooks, one runtime for everything — the developer wrote: *"big night that should massively boost content item creation velocity — it's practically a DSL."*

That phrase, "practically a DSL," is the payoff for the winter and the Ten Commandments and the two resets. When the architecture is right, adding things is fast. When you're fighting the architecture, every new feature costs you. The goal of all the architectural work — the ECS pivot, the Great Reset, the return with Deno, the verb pipelines and data hooks — was always to get here: a system where content is data, behavior is hooks, and adding a new item means filling in a definition, not writing a new branch in a switch statement.

---

## What It Actually Is

The Ten Commandments document has twelve commandments (the title stayed at ten). The twelfth was added later, after yet another temptation had been identified and named. The document grows. The list of specific mistakes that can be made is specific because each one was made.

Commandment XI ends with: *"If you are excited about the math, that is the warning sign."*

This is not a rule about mathematics. It's a rule about the difference between problems that are interesting and problems that matter. The lighting was genuinely interesting. The geometry kernel was elegant. The quad-bezier plasma cloud trajectory is satisfying to implement. None of those things made the game more fun to play, until the architecture was solid enough to support them without consuming the project.

The real story of JSHack is the story of a developer who kept making the same mistake — getting seduced by beautiful, interesting, technically-impressive work that didn't serve the game — and who was self-aware enough to write it down each time, with exact line counts and dates, so that the mistake could be recognized faster the next time it arrived.

It arrived again. It usually does.

The game exists. It has gods and pets and hunger and material conduction and a Scroll of Homecoming that works. The architecture is becoming a DSL. The TODO says *"Do Not Drift"* at the top.

---

*The repository is at https://github.com/PJensen/JSHack.*
*The Ten Commandments are in [TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md).*
*The first commit was October 15, 2025.*
*Today is February 19, 2026.*
*The work continues.*
