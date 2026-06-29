# Cloud Layer

`src/cloud/` owns optional infrastructure-backed features. The game must keep
working when this layer is unavailable.

Allowed here:

- Remote worker clients and endpoint schemas.
- Cloud-backed feature wiring such as tombstones, highscores, score proofs, mail,
  daily challenges, and community events.
- Browser APIs needed by those features, including `fetch`, Web Crypto, and
  fire-and-forget telemetry.

Boundary rules:

- `rules/` must not import `cloud/`.
- Cloud data that decorates gameplay enters deterministic code through explicit
  dependencies from `main/`, with local/offline fallback behavior.
- Cloud features must not mutate ECS state directly unless they route through
  canonical main/rules entrypoints for that behavior.
- Worker failures must not break combat, quests, crafting, NPCs, generation, or
  local saves.
