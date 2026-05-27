# Shop Claim Follow-ups

## Speech bubble reliability

Shop claim dialogue currently routes through `npc:dialogue`, which is presented by speech bubbles. The speech bubble wiring drops NPC dialogue when the speaker is more than 8 tiles from the player.

Risk:
- Critical shopkeeper lines like payment demands, credit warnings, and refusal escalation can disappear in large shops or when the shopkeeper is away from the exit.

Follow-up:
- Let shop claim dialogue carry a priority/range hint, or special-case `source: "shop:claim-enforced"` and `source: "shop:unauthorized-use"` so those lines reach the player reliably.
- Add a test proving shop enforcement speech surfaces even when the shopkeeper is outside normal ambient chatter range.

## Stacked unpaid consumables

Unpaid potion use records debt before `consume`. For stacked potions, `consume` may decrement `ItemInfo.count` instead of destroying the entity, while `Unpaid` remains on the stack.

Risk:
- A single quaff may charge the full stack price.
- The remaining stack may still be marked unpaid, causing a second bill for value already charged.

Follow-up:
- Decide whether `Unpaid.price` means per entity, per stack, or per unit.
- If stacks can be unpaid, charge only the consumed unit and adjust the remaining unpaid price/count consistently.
- Add a regression test for unpaid stacked potion quaffing.
