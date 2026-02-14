# Contributing to JSHack

Thanks for your interest in JSHack! This is a personal project with a clear vision,
and contributions that align with that vision are welcome. That said, this is early
days — not every PR will be merged, and that's okay. If you're unsure whether
something fits, open an issue first and let's talk about it.

---

## Before You Start

Please read these two documents. They exist because hard lessons were learned:

- **[TEN_COMMANDMENTS.md](TEN_COMMANDMENTS.md)** — The project constraints. Non-negotiable.
- **[SEPARATION_MANIFEST.md](SEPARATION_MANIFEST.md)** — The layer boundaries between rules and display.

If your change would violate either of these, it won't be merged.

JSHack is built on an **Entity-Component-System** architecture. Entities are IDs,
components are plain data objects, and systems are functions that query and transform
them. The ECS library is [ecs-js](https://github.com/PJensen/ECS-js) (vendored in
`src/lib/ecs-js/`). If you're new to ECS, the [README](README.md#-ecs-architecture-you-can-actually-see)
walks through the basics and the source is designed to be readable.

## Setting Up

```bash
git clone https://github.com/PJensen/JSHack.git
cd JSHack
open index.html
```

That's it. No `npm install`. No build step. Edit a file, refresh your browser.

## Running Tests

We use **Deno**, not Node:

```bash
deno test --allow-read tests/
```

If your change touches game logic, it needs a test. See Commandment V.

## What Makes a Good Contribution

- A new monster, item, or spell with tests
- A bug fix with a regression test
- A new system that follows the ECS pattern and registers cleanly
- Improvements to mobile/touch controls
- Better dungeon generation

## What Will Get Declined

- Adding npm, webpack, babel, or any build tooling
- Adding TypeScript or a framework
- Mixing the rules and display layers
- Breaking determinism (same seed must produce same results)
- Large refactors without prior discussion
- "Improvements" that solve problems the player can't see

## Submitting a PR

1. Fork the repo and create a branch
2. Make your changes — keep them focused and small
3. Run the tests and play the game to make sure nothing broke
4. Open a PR with a clear description of what and why

There's no PR template or checklist to fill out. Just be clear about what you did
and why it matters to the game.

## A Note on the License

JSHack is licensed under the **Human-Scale Source License (HSSL) v1.2**. This is
**not** an open-source license as defined by the OSI. It's source-available, intended
for individuals, students, researchers, and small organizations. By submitting a PR,
you agree that your contribution falls under the same license terms. Please read
[LICENSE](LICENSE) if you haven't already.

## Expectations

This is a hobby project built for fun. Response times on issues and PRs will vary.
Sometimes good code just doesn't fit the direction of the project, and that's not a
reflection on the contributor. If a PR is declined, I'll try to explain why.

The goal is to keep JSHack small, hackable, and fun. Contributions that serve that
goal are genuinely appreciated.
