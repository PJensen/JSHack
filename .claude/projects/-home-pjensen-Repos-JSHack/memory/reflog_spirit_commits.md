---
name: Spirit Wisp Reflog Commits
description: Lost commits from soft-reset containing spirit wisp evolution (mood, miracle, prayer, death vigil, betrayal features)
type: reference
---

22 commits soft-reset on 2026-04-02. All recoverable via `git reflog`:

- `b0a38540` — "AMAZING" — the OG spirit wisp baseline (ball of light + particle trail, fixed cyan-white)
- `587f8e1e` — "M" — first mood color integration on wisp
- `842ade84` — "MOOD BOARD" — mood-tinted halo/core
- `4475cd98` — "SNAPSHOT"
- `318ad33a` — "MIRACLE ANCHORS" — miracle flight, betrayal, danger sense, prayer spiral, death vigil added
- `fb17ad24` — "EASING"
- `6a3797ce` — "MV BUTTON"
- `7e86fac9` — "DEATH" — death vigil behavior
- `54900ac0` — "UX ADJUST"
- `d7e31422` — "UX"
- `2c0098fe` — "UX TUNES"
- `9d3594ee` — "UX" — final state before reset

**Why:** User soft-reset these and regretted losing the spirit evolution work. Reflog entries will eventually expire.

**How to apply:** If we need to recover any of these, use `git show <sha>:path/to/file` to extract specific file versions.
