# Playtest Follow-ups — June 22, 2026

## Deferred Architecture Note

- [ ] Consider allowing simple interactable archetypes to author their
      interaction behavior directly through `Interactable`, instead of tracing
      behavior through a separate identity registry.
  - Target authoring shape:

    ```js
    [Interactable, { action: "browseRack", params: null }]
    ```

  - Keep this deferred until the higher-value playtest issues below are done.
  - Any eventual design must preserve the canonical interaction runtime rather
    than creating a second execution path.

## Teleportation

- [x] Replace the abrupt teleport camera move with a deliberate transition for
      fountain teleports and teleportation generally.
  - Minimum treatment: fade out, teleport, then fade in.
  - Evaluate whether a more visually distinctive transition reads better while
    keeping the destination change clear.
  - Ensure the transition works for every canonical teleport source rather
    than special-casing the fountain.

- [x] Increase the drop rate of the Scroll of Teleportation so it is a more
      dependable escape resource during normal play.
  - Audit every loot source/weight that can produce the scroll before choosing
    the new rate.
  - Add or update a distribution/weight test so the intended availability is
    explicit.

## Quest Sequence Robustness

- [x] Make **The Book Below** work when its objectives are completed out of
      sequence, including when the player already owns the book before accepting
      or advancing the quest.
  - Turn-in eligibility reads current inventory directly; no recovered-item
    shadow state is retained.
  - Preserve the canonical inventory and quest progression paths.
  - Cover both normal-order and book-already-owned cases in tests.

- [x] Make **Rat Infestation** completable when accepted after the dungeon has
      already been cleared.
  - Lock the relevant dungeon entrance with a very hard lock for this quest
    flow.
  - Give the player the corresponding key when the quest is accepted.
  - Verify the key is granted exactly once and remains available in the
    post-clear acceptance case.
  - Cover normal-order and dungeon-cleared-before-acceptance cases in tests.

## Polymorph Presentation

- [x] Emit a small magical-smoke-puff VFX on a successful Polymorph cast.
  - Use the puff to obscure the otherwise harsh glyph swap.
  - Trigger it only when polymorph succeeds.
  - Route it through the existing canonical spell/VFX event pipeline.
  - Add focused coverage for success versus failure emission.
