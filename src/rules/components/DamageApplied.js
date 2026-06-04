import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DamageApplied — a short-lived rules record created by the canonical damage
 * pipeline after HP has been changed.
 *
 * This is for scheduled rules follow-up. The `damaged` event remains a
 * presentation/debug receipt and must not be used to mutate rules-side truth.
 */
export const DamageApplied = defineComponent("DamageApplied", {
  target: 0,
  source: 0,
  amount: 0,
  hpBefore: 0,
  hpAfter: 0,
  maxHp: 0,
  rawAmount: 0,
  type: "",
  cause: "",
  critical: false,
  weaponId: 0,
  weaponFamily: "",
  offhand: false,
  at: null,
  impactVector: null,
  step: 0,
});
