import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * DeathApplied — a short-lived rules record created by the canonical damage
 * pipeline after an entity has crossed into death.
 *
 * This is for scheduled rules follow-up. The `died` event remains a
 * presentation/debug receipt and must not be used to mutate rules-side truth.
 */
export const DeathApplied = defineComponent("DeathApplied", {
  target: 0,
  killer: 0,
  cause: "",
  weaponId: 0,
  weaponFamily: "",
  damageType: "",
  critical: false,
  amount: 0,
  goreType: "",
  sizeClass: "",
  impactProfile: null,
  targetKind: "",
  at: null,
  step: 0,
});
