# Headless Runtime

JSHack now has a headless runtime path that runs the real rules scheduler and world view pipeline without `main.js`.

## Run

```bash
deno task headless --turns 500 --report-every 100
```

Options:

- `--seed <number>`: world seed (default `0xC0FFEE`)
- `--class <id>`: player class id (default `outlaw`)
- `--name <text>`: player name (default `Headless Hero`)
- `--depth <number>`: dungeon start depth (default `1`)
- `--turns <number>`: turns to simulate (default `500`)
- `--report-every <number>`: emit periodic JSON report every N turns (default `100`)
- `--player-wait true|false`: dispatch `rules.wait` each turn instead of raw `world.tick(1)` (default `false`)
- `--dungeon-type <id>`: optional floor profile override
- `--actions-file <path>`: JSON schedule of actions by turn

## Action Schedule File

`--actions-file` expects a JSON array:

```json
[
  {
    "at": 1,
    "action": { "type": "rules.wait", "payload": {} }
  },
  {
    "at": 2,
    "action": { "type": "rules.move", "payload": { "dx": 1, "dy": 0 } }
  }
]
```

Actions are passed through `makeRulesDispatcher`, so they use the same intent translation path as the app.

## Runtime Core

Shared runtime facade lives at:

- `src/main/runtime/gameRuntime.js`

It owns:

- world creation and scheduler configuration
- dungeon initialization
- player creation and class loadout
- action dispatch (`makeRulesDispatcher`)
- simulation stepping
- world snapshot and `buildWorldView` projection

This keeps browser-only concerns in `main.js` and allows deterministic simulation/perf tooling from Deno.
