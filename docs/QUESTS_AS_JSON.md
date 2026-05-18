# Quests As JSON

This is a proposal for making quests more data-auditable without throwing away the current quest runtime.

The goal is not to move every line of quest behavior into JSON. The goal is to move the parts that need to be searchable, reviewable, and scalable into structured data:

- Quest identity.
- Quest title.
- Giver role or source.
- Journal flavor.
- Tracker text.
- Objective shape.
- Reward item IDs.
- Reward gold.
- Service unlocks.
- Town unlocks.
- Completion text.
- Simple node transitions.

The existing JS quest runtime should remain the execution layer. JSON should describe the quest contract; JS should provide canonical handlers.

## Why

JSHack already has a lot of quests, rewards, NPCs, town services, items, and hidden mechanics. The problem is that too much is buried in bespoke JS definitions and hand-authored text.

Structured quest data would let us answer questions quickly:

- Which quests only reward gold?
- Which quests expose `rewardItemIds`?
- Which NPCs have no meaningful service unlock?
- Which unique items are never used as quest rewards?
- Which quests have no visible tracker reward?
- Which quests ask the player to delve?
- Which quests change the town afterward?

That kind of audit is hard when quest contracts are scattered through imperative code.

## What Should Be JSON

A quest JSON entry should own stable authoring data:

```json
{
  "id": "starter.rat_infestation",
  "title": "Rat Infestation",
  "version": 1,
  "giverRole": "barkeep",
  "journal": {
    "flavorText": "The barkeep is tired of hearing claws in the cellar walls.",
    "rewardItemIds": ["bow_mirror"],
    "rewardItems": [
      { "label": "a hot stew from the barkeep", "count": 1 }
    ]
  },
  "vars": {
    "accepted": false,
    "killCount": 0,
    "reported": false,
    "rewardItemIds": ["bow_mirror"],
    "rewardGold": 75,
    "rewardGranted": false
  },
  "objectives": [
    {
      "kind": "kill",
      "monsterId": "rat",
      "count": 5,
      "trackerLabel": "Clear the tavern cellar"
    },
    {
      "kind": "returnToGiver",
      "trackerLabel": "Return to the barkeep"
    }
  ]
}
```

The important part is `rewardItemIds`, not hand-authored reward prose. Reward display should be derived from the catalog at runtime.

## What Should Stay JS

JS should own canonical behavior handlers:

- `acceptQuest`.
- `killMonsterObjective`.
- `fetchItemObjective`.
- `returnToNpcObjective`.
- `reachDepthObjective`.
- `spawnQuestItem`.
- `spawnQuestBoss`.
- `grantQuestRewards`.
- `unlockTownService`.
- `advanceQuestNode`.
- `completeQuest`.

Any quest that needs bespoke behavior can still attach a JS handler by ID:

```json
{
  "onAccept": ["starterRat.giveBowAndSpawnRat"],
  "onComplete": ["questRewards.grantStructuredRewards"]
}
```

The handler IDs map to registered JS functions. This keeps JSON deterministic and auditable while avoiding a giant unsafe expression language.

## Hybrid Loader

Add a loader that compiles JSON into the existing `registerQuest(...)` shape.

Candidate path:

```text
src/rules/quests/data/starterQuests.json
src/rules/quests/jsonQuestLoader.js
src/rules/quests/jsonHandlers.js
```

The loader should:

1. Validate IDs and required fields.
2. Convert objective kinds into runtime event subscriptions.
3. Populate default vars.
4. Attach `rewardItemIds` into journal and vars.
5. Register the compiled quest with `registerQuest`.

The existing quest runtime remains authoritative.

## First Migration Target

Start with `Rat Infestation`.

Why:

- It has a simple kill-count objective.
- It has an NPC giver.
- It has an acceptance beat.
- It now has structured `rewardItemIds`.
- It has tests around tracker, journal, dialogue, and reward grant.

Do not migrate all quests at once.

Migration sequence:

1. Create `starterQuests.json` with only `starter.rat_infestation`.
2. Add a loader that compiles that one quest to the same runtime behavior.
3. Keep custom acceptance behavior in a named JS handler.
4. Keep reward grant generic through `rewardItemIds`.
5. Run the existing focused tests.
6. Only then migrate `The Book Below`.

## Validation Tests

Add tests that inspect JSON quest data directly:

- Every non-generic quest has at least one non-gold reward field.
- Every `rewardItemIds[]` entry exists in `ITEM_CATALOG`.
- Every `giverRole` exists in townfolk data.
- Every objective kind is supported by the loader.
- Every custom handler ID exists in the handler registry.
- Every quest has journal flavor and tracker text.

These tests are the main reason to move toward JSON.

## Risks

JSON can become its own bad DSL if it tries to express arbitrary logic.

Avoid:

- Inline JS expressions in JSON.
- Complex conditional languages.
- Duplicated item descriptions.
- Duplicated NPC names.
- Duplicated spell or item mechanics.
- Moving runtime-only state into static authoring data.

Prefer:

- Small objective vocabulary.
- Named handler IDs.
- Catalog-derived reward descriptions.
- Runtime events handled by existing quest machinery.
- JS for anything genuinely bespoke.

## Decision

This is worth doing after the immediate reward-contract work is solid.

Do not pause all progression work to convert everything. First make one quest excellent, visible, and reward-driven. Then migrate that quest to JSON as the proving ground.

If the JSON version is cleaner, easier to audit, and keeps all existing tests green, migrate the next two starter quests.
