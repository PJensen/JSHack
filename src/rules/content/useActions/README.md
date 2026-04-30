# Use Actions

Use actions are the rules-layer contract for item-driven actions that need more
than a one-shot `onUse` hook.

Items keep their authored identity and UI affordances in `src/content/items/*`.
The matching rules behavior is registered once with `defineUseAction(identity,
def)`. Systems and app wiring look up the action by item identity instead of
branching on specific ids.

```js
defineUseAction("fishing_rod", {
  channelTurns: 12,
  targeting: {
    name: "Fishing",
    fallbackRange: 6,
    validateTarget(x, y) {
      return isFishableTile(getTile(x, y)) ? null : "Fishing must target water.";
    },
    onConfirm(world, actorId, itemId, x, y) {
      emitSafe(world, "fishing:cast:request", { actor: actorId, itemId, x, y });
    },
  },
  onComplete(world, actorId, channel) {
    // Resolve the completed item channel.
  },
});
```

Rules:

- Register from an install function called once per world with a domain-specific
  `Symbol.for("jshack:<domain>:<what>:installed")` guard when listeners are
  involved.
- Store active channel state on `Channeling.itemActionId`; `channelingSystem`
  dispatches completion through `getUseAction()`.
- Keep targeting metadata presentation-neutral. App/display code may use it to
  open a targeter, but rules validation and completion stay in rules/content.
- New tools should add a declaration here rather than editing
  `castSpellSystem`, `channelingSystem`, or `main.js` for identity-specific
  branches.
