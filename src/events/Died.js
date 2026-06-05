import { EcsEvent } from "../lib/ecs-js/index.js";
import { normalizeGridPoint } from "../shared/math/point.js";

/**
 * Typed presentation/debug receipt for canonical entity death.
 *
 * Durable rules consequences should consume DeathApplied records, not this
 * event. This class formalizes the observation contract for new consumers
 * while the legacy "died" string receipt remains during migration.
 */
export class Died extends EcsEvent {
  constructor(payload = {}) {
    super();

    const id = Number(payload.id ?? payload.target ?? 0) | 0;
    if (!(id > 0)) throw new Error("Died.id must be a positive entity id");

    this.id = id;
    this.killer = Number(payload.killer || 0) | 0;
    this.cause = String(payload.cause || "");
    this.weaponId = Number(payload.weaponId || 0) | 0;
    this.weaponFamily = String(payload.weaponFamily || "");
    this.damageType = String(payload.damageType || "");
    this.critical = !!payload.critical;
    this.amount = Number(payload.amount || 0) | 0;
    this.goreType = String(payload.goreType || "");
    this.sizeClass = String(payload.sizeClass || "");
    this.impactProfile = payload.impactProfile || null;
    this.targetKind = String(payload.targetKind || "");
    this.at = normalizeGridPoint(payload.at);

    Object.freeze(this);
  }

  toLegacyPayload() {
    const out = {
      id: this.id,
      killer: this.killer,
      cause: this.cause,
      weaponId: this.weaponId,
      weaponFamily: this.weaponFamily,
      damageType: this.damageType,
      critical: this.critical,
      amount: this.amount,
      goreType: this.goreType,
      sizeClass: this.sizeClass,
      impactProfile: this.impactProfile || undefined,
      targetKind: this.targetKind,
    };
    if (this.at) out.at = { x: this.at.x | 0, y: this.at.y | 0 };
    return out;
  }
}
