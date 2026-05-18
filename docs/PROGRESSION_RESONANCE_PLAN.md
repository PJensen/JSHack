# Progression Resonance Plan

JSHack already has a large amount of progression, town, quest, item, spell, and simulation machinery. The current problem is not a lack of features. The problem is that too many of the strongest systems are buried, and the player-facing reward contract does not consistently tell the player what they can earn, why it matters, or how the town and dungeon will change because of it.

This document is the anchor for turning the current feature-rich technical demo into a more resonant game loop.

## Core Diagnosis

The game has:

- Quest definitions and runtime state.
- A quest journal payload.
- A focused HUD quest tracker.
- Starter quests.
- A generated run-contract boss/relic quest.
- Notice-board offers tied to district pressure.
- Town economy and district simulation.
- Reactive townfolk dialogue.
- Shops, appraisal, enchanting, smithing, alchemy, cooking, fishing, and other service surfaces.
- A deep item catalog with build-defining rare, epic, legendary, and artifact gear.
- Spellbooks and scrolls that can permanently or temporarily change play.
- Proc-package gear with distinctive mechanics.

The weak point is reward presentation and payoff.

Most visible quest completion still collapses into gold, even when the game has much stronger rewards already implemented. Gold is useful as a general economy lubricant, but it is too weak as the primary quest reward. The player should look at a quest and think, "I want that reward," before committing to it.

## Current Evidence

### Quest Tracker And Journal Already Exist

The HUD tracker is already able to focus active objectives and show progress:

- `src/main/ui/hudFeeds.js`
- `buildQuestTrackerEntry`
- `updateQuestTrackerHUD`

The quest journal already has reward text plumbing:

- `src/main/ui/inventoryDataProvider.js`
- `questJournalRewardText`
- `ui:requestQuestJournalData`
- `ui:questJournalData`

This means reward visibility does not need a new UI concept from scratch. It needs richer quest reward data and stronger tracker/journal presentation.

### Starter Quests Have Strong Setup, Weak Payoff

`Rat Infestation` has a good opening beat:

- The barkeep gives a short bow and arrows on acceptance.
- A rat spawns immediately near the barkeep.
- The quest tracks rat kills and advances to report.

But completion pays mostly:

- `75 gold`
- `food_stew`

That is functional, but it does not create a build promise.

`The Book Below` has strong flavor:

- A priest asks for the `Book of the Dead`.
- The book is seeded on dungeon depth 1 near the deeper stair.
- It creates a clear early reason to delve.

But completion pays:

- `100 gold`

Again, useful, but emotionally flat for a quest with strong thematic setup.

### Run Contract Is Close To A Real Spine

`run.contract` already has:

- A generated named boss.
- A generated boss depth.
- A generated relic.
- A checklist.
- A kill objective.
- A relic recovery objective.
- A return-to-town completion condition.

This is close to the shape the game wants. The weak part is that the relic is treated mostly as a trophy hand-in and the completion reward is still gold.

Run contracts should become one of the major places where the player sees and earns special things.

## Design Principle

Every meaningful quest should have an obvious prize.

The prize can be:

- A named unique item.
- A rare or epic spellbook.
- A service unlock.
- A permanent town improvement.
- A new town-control lever.
- A companion or pet upgrade.
- A shortcut, safe route, or dungeon access change.
- A shop stock expansion.
- An enchanting, smithing, blessing, repair, or appraisal upgrade.
- A class-relevant reward choice.

Gold can remain part of the reward, but it should rarely be the headline.

## Reward Schema

Add an explicit quest reward schema that can be consumed by the journal, tracker, completion events, and tests.

Suggested fields:

```js
{
  rewardPreview: "Glacier Sigil - frost spells can root struck enemies.",
  rewardItemId: "glacier_sigil",
  rewardItemLabel: "Glacier Sigil",
  rewardServiceUnlock: "",
  rewardChoice: [],
  rewardGold: 0,
  rewardGranted: false,
}
```

For reward choices:

```js
{
  rewardPreview: "Choose one: Glacier Sigil, Mirror Bow, or Fishing Rod.",
  rewardChoice: [
    {
      itemId: "glacier_sigil",
      label: "Glacier Sigil",
      summary: "Frost spells can root struck enemies.",
    },
    {
      itemId: "bow_mirror",
      label: "Mirror Bow",
      summary: "Wall-side arrow impacts ricochet into nearby hostiles.",
    },
    {
      itemId: "fishing_rod",
      label: "Fishing Rod",
      summary: "Cast near water to channel a catch.",
    },
  ],
}
```

The tracker should show the reward preview whenever practical. The quest journal should show the full reward detail. Completion should grant exactly what was promised.

## First Conversion Targets

### Rat Infestation

Current payoff:

- 75 gold.
- Hot stew.

Proposed payoff:

- Show reward up front in tracker and journal.
- Keep small gold/stew as incidental flavor.
- Add a real reward choice or fixed early build item.

Candidate reward options:

- `glacier_sigil`: teaches the player that offhand gear can modify spells and make frost more tactical.
- `bow_mirror`: extends the bow/arrows acceptance beat into a real ranged build hook.
- `fishing_rod`: opens a town/overworld activity and hidden loot economy.

Possible presentation:

```text
Reward: choose one tavern prize - Glacier Sigil, Mirror Bow, or Fishing Rod.
```

If a choice UI is too large for the first slice, start with a fixed reward:

```text
Reward: Glacier Sigil - frost spells can root struck enemies.
```

### The Book Below

Current payoff:

- 100 gold.

Proposed payoff:

- Keep a modest gold amount if desired.
- Make the real reward priest-themed and visible from the start.

Candidate rewards:

- `book_smite`
- `book_consecrate`
- `book_divine_shield`
- `scroll_remove_curse`
- Unlock priest service: bless one item, remove one curse, or perform paid cleansing thereafter.

Possible presentation:

```text
Reward: Spellbook of Smite and access to priestly cleansing.
```

This makes the priest matter after the quest and gives the player a reason to return.

### Run Contract

Current payoff:

- Generated boss and relic.
- Gold on completion.

Proposed payoff:

- The generated relic should be tied to a special reward, town upgrade, or item unlock.
- The reward should be visible when the contract appears.
- The relic return should change the town or unlock a service, not just become gold.

Candidate reward models:

- Return `Ember Censer`: unlock fire enchant recipes, flame ward discounts, or `sunsword` access.
- Return `Glass Heart`: unlock gem appraisal/socket discounts or `conduction_lens`.
- Return `Pale Idol`: unlock priest blessing/curse services or undead-focused rewards.
- Return `Stone Tongue`: unlock town-board command, district assignment, or deeper run contracts.

Possible presentation:

```text
Reward: Ember Censer unlocks advanced fire bindings at the Enchantress.
```

## Promote Buried Gear Into Authored Rewards

The catalog already has many items that are strong enough to anchor quests.

Initial reward candidate pool:

- `sunsword`
- `dawnbreaker`
- `sun_vessel`
- `conduction_lens`
- `echo_grimoire`
- `glacier_sigil`
- `ring_conflict`
- `scroll_genocide`
- `lodbrok_serpent_bound_breeches`
- `fishing_rod`
- `book_phase_strike`
- `book_summon_skeleton`
- `book_smite`
- `book_consecrate`
- `book_divine_shield`
- `bow_mirror`

These should not only be random loot outcomes. Some should be promised, pursued, and remembered.

## NPCs As Levers

Townfolk already exist as more than static scenery, but most NPCs are not yet strong gameplay interfaces.

Current high-value service surfaces include:

- Enchantress: enchanting service, reagent explanation, binding recipes.
- Smith/anvil: material-based forging.
- Shops: buy, sell, appraisal, shop ownership, unpaid stock, shopkeeper behavior.
- Priest: quest giver and thematic hook.
- Barkeep: starter quest giver and town flavor.
- District board: local generated work and town pressure.

The next step is to make NPCs own progression levers.

Examples:

- Smith repairs degraded gear, improves durability, unlocks better smith recipes after supply quests.
- Priest blesses, uncurses, cleanses poison/disease, unlocks holy spell rewards after graveyard quests.
- Barkeep gives rumors, bounty leads, run contracts, food buffs, and traveler reports.
- Enchantress expands recipes through relic returns and reagent quests.
- Gem merchant expands socket/appraisal services after rare gem or relic quests.
- Bookseller curates spellbook rewards after book recovery or dungeon lore quests.
- Herbalist converts reagents into antidotes, resistance prep, or field kits.
- Fisher gives water-route rumors, fishing upgrades, or rare catch quests.

The town should become a set of strategic interfaces, not only a simulated backdrop.

## Town Services And Gear Degradation

Gear degradation could create reasons to revisit NPCs, but it should be used carefully.

Good degradation:

- Creates tactical decisions.
- Makes the smith matter.
- Makes material and repair supplies valuable.
- Produces visible warnings before failure.
- Can be mitigated by skill, service, materials, or special items.

Bad degradation:

- Becomes a maintenance tax.
- Punishes exploration without creating meaningful decisions.
- Forces town visits on a timer without interesting choices.

If added, start narrow:

- Only weapons and armor gain wear from combat.
- Wear reduces value or effectiveness in small steps.
- Smith repair is clear, cheap early, and can improve into upgrade services.
- Some special items resist degradation or interact with it.

## NPC Assignment And Town Control

Player-directed NPC assignment may be stronger than generic maintenance pressure.

Potential model:

- The town board exposes district pressures and open jobs.
- The player can assign or influence NPC priorities.
- Assignments change production, safety, shop stock, service quality, and quest availability.

Examples:

- Send the smith to repair civic damage: fewer structure penalties, slower forge output.
- Keep the smith at the forge: better gear stock, repairs slower.
- Assign the priest to ward the graveyard: undead pressure falls, cleansing services cost more or become unavailable temporarily.
- Assign the herbalist to medicine production: more antidotes, fewer field reagents.
- Assign the fisher to supply tavern: food pressure drops, fishing rumors become rarer.
- Assign a guard/patrol: road danger drops, but town shop security changes.

This would make the town simulation legible and controllable without discarding its autonomy.

## Implementation Sequence

### Phase 1: Reward Visibility Contract

Goal: every meaningful active quest clearly states what it pays.

Actions:

1. Add quest reward fields to quest vars/journal definitions.
2. Update `questJournalRewardText` to prefer structured reward previews.
3. Update HUD tracker payload to include a compact reward preview.
4. Update tracker rendering to show reward text when a quest is active.
5. Add tests that active quests expose non-empty meaningful reward text.

Done when:

- Rat quest tracker shows an explicit item/service reward before completion.
- Quest journal shows the same reward in more detail.
- Gold-only reward text is no longer the default for major quests.

### Phase 2: First Reward Conversion

Goal: prove the model with one complete quest.

Recommended first target:

- Rat Infestation.

Actions:

1. Pick a fixed reward or a small choice set.
2. Put that reward in quest vars/journal on acceptance.
3. Grant the promised item on turn-in.
4. Keep gold/stew as secondary flavor.
5. Add a completion test that verifies the exact reward item is granted.
6. Add a journal/tracker test that verifies the reward is visible before completion.

Suggested first fixed reward:

- `glacier_sigil`

Reason:

- It is unusual, powerful, and build-shaping.
- It teaches that offhand gear can change spell behavior.
- It is not merely a stat stick.

### Phase 3: Priest Quest Service Unlock

Goal: turn a quest giver into a persistent service NPC.

Actions:

1. Change `The Book Below` reward to a spellbook and/or priest service unlock.
2. Add a simple service flag to quest vars or town state.
3. Add priest dialogue branch for the unlocked service.
4. Implement one service: bless, uncurse, cleanse poison/disease, or identify cursed equipment.
5. Show the service unlock in the quest reward preview.

Suggested first reward:

- `book_smite` plus "Priest can cleanse curses."

### Phase 4: Run Contract Relic Upgrades

Goal: make run contracts the long-form delve spine.

Actions:

1. Map each run-contract relic to a reward category.
2. Show the mapped reward in the contract objective.
3. On relic return, grant the mapped unlock instead of only gold.
4. Add town dialogue acknowledging the returned relic.
5. Add tests for each relic mapping.

Suggested mappings:

- Ember Censer: unlock advanced fire enchantment or fire-themed gear.
- Glass Heart: unlock advanced gem/socket/appraisal service.
- Pale Idol: unlock priest blessing/holy reward.
- Stone Tongue: unlock town board command or district assignment.

### Phase 5: Town Lever Pass

Goal: make NPCs strategic interfaces.

Actions:

1. List each townfolk role and its current mechanical surface.
2. Assign exactly one player-facing service or lever to each role.
3. Prefer existing mechanics first.
4. Tie each lever to a quest, district state, or unlock.
5. Add board/journal text that points the player to the NPC.

Do not build a new town control simulation until rewards and service unlocks are visible and working.

## Test Policy

Add regression tests around player-facing reward promises.

Required tests:

- Major active quests expose `rewardPreview` or equivalent reward text.
- Quest journal includes the promised reward.
- HUD tracker receives the promised reward.
- Completion grants the promised item/service/unlock.
- Completion event includes enough payload for message/UI feedback.
- Gold-only major quest rewards fail unless explicitly marked as generic work.

Recommended invariant:

```text
Every non-generic quest must promise at least one non-gold reward.
```

Generic notice-board filler can still pay gold, but district-driven offers should increasingly move toward service, stock, or town-state outcomes.

## Near-Term Vertical Slice

The fastest slice that would prove the new direction:

1. Rat Infestation reward preview:

```text
Reward: Glacier Sigil - frost spells can root struck enemies.
```

2. Tracker shows the reward while the quest is active.

3. Journal shows the full reward.

4. Turn-in grants `glacier_sigil`, plus small gold/stew if desired.

5. Barkeep or smith has a post-completion line acknowledging the reward.

6. Tests verify visibility and grant.

This single slice would immediately shift the game from "do task, get money" toward "pursue a visible build-changing prize."

## Strategic North Star

The player should always have at least one visible reason to delve.

That reason should usually be a specific thing:

- A named item.
- A spell.
- A service.
- A town lever.
- A boss.
- A relic.
- A visible unlock.

The game already contains enough amazing material. The work now is to surface it, promise it, pay it off, and let the town remember it.
