# Shop Law Debt Model Follow-up

## Problem

`ShopDebt` and the new shop-law incident path overlap heavily.

`ShopDebt` already records:
- debtor actor
- owning shopkeeper
- item/value
- amount
- reason
- creation turn
- unpaid/paid/forgiven status

The incident record adds evidence, severity, and resolution state, but for many
cases it is effectively a second fact about the same value extraction.

Examples:
- consuming unpaid stock
- throwing unpaid stock out of the shop
- stack-throw conversion to value debt
- knowledge theft from an unpaid spellbook

In these cases, a richer `ShopDebt` may be enough.

## Core Question

Should shop law be modeled as:

1. `ShopDebt` as the canonical economic/legal claim, with richer fields for
   evidence, severity, and response state.
2. A separate `ShopIncident`/memory topology for suspicion, witnesses, attempted
   exploits, and events that do not create a payable bill.
3. Both, but only when their responsibilities are clearly non-overlapping.

## Current Useful Distinction

The strongest reason for a separate incident fact is carried unpaid stock that
escapes shop control without being converted into extracted-value debt.

Example:
- Player carries an unpaid gem.
- Player teleports from inside the shop to outside.
- The gem still has `Unpaid`; the bill can still be computed from carried goods.
- The shop still needs a memory fact saying `teleport_exit` happened.

That is not quite the same as debt, because the physical claim still exists.

## Proposed Direction

Consider collapsing the duplicative extraction path:

- Keep `Unpaid` as canonical physical ownership.
- Keep `ShopDebt` as canonical extracted-value claim.
- Extend `ShopDebt` if needed with fields such as:
  - `evidence`
  - `severity`
  - `responseTier`
  - `lastKnownReason`
  - `resolvedTurn`
- Use separate incident/memory facts only for non-debt facts:
  - suspicious handling
  - attempted exploit with no extracted value yet
  - carried unpaid goods escaping containment
  - witness/social propagation
  - delayed consequence scheduling

## Follow-up Work

- Re-read `src/rules/utils/shopLaw.js` and identify which records are true debts
  versus non-debt memories.
- Decide whether `recordUnpaidExtraction()` should create only `ShopDebt`.
- If incidents remain, rename or reshape them so they are not isomorphic with
  debt.
- Add tests that prove the distinction:
  - consumed item creates debt, not duplicate memory unless needed
  - teleport with carried unpaid stock creates memory/claim pressure but not
    extracted-value debt
  - suspicion/warning can exist without debt
