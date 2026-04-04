import { FloatText } from "../passes/vfx/text/floatText.js";
import { createStatusEmitterController } from "../passes/vfx/particles/statusEmitterController.js";
import { createBoltFxController } from "../fx/boltFxController.js";
import { createDelayedDeathFxController } from "../fx/delayedDeathFxController.js";
import { createProjectileFxController } from "../fx/projectileFx.js";
import { createSpellAreaFxController } from "../fx/spellAreaFx.js";
import { createCloudFxController } from "../fx/cloudFx.js";
import { createSurfaceAreaFxController } from "../fx/surfaceAreaFx.js";
import { createSpiritWispFxController } from "../fx/spiritWispFx.js";
import { createStatusPresentationDelayController } from "../fx/statusPresentationDelayController.js";
import { createBumpFxController } from "../fx/bumpFxController.js";
import { createRecoilFxController } from "../fx/recoilFxController.js";
import { createHitstopController } from "../fx/hitstopController.js";
import { createDeathEssenceFxController } from "../fx/deathEssenceFxController.js";
import { startShake } from "../camera/shake.js";
import { startZoomPunch } from "../camera/zoomPunch.js";
import { installFloatTextWiring } from "../ui/wiring/floatTextWiring.js";
import { installEventUiWiring } from "../ui/wiring/eventUiWiring.js";
import { createDeathVfxController } from "../fx/deathVfxController.js";

/**
 * Configure display-owned runtime controllers and event wiring.
 * Returns live controller instances used by the frame loop and render pass.
 */
export function setupDisplayRuntime({
  world,
  cam,
  fx,
  PERF,
  getFxTime,
  getActiveSpellId,
  setActiveSpell,
  getPosition,
  getEntityIdentity,
  getEntityVitality,
  isVisibleAt,
  isPet,
  isPlayer,
  getPlayerEntity,
  getItemInfo,
  resolveItemDisplayName,
  dispatchRulesAction,
  classifySurfaceTile,
  sculptFloor,
  sculptFloorBrush,
  getActiveReliefKey,
  sampleMood,
}) {
  const statusEmitterFx = createStatusEmitterController({ world, fx });
  statusEmitterFx.installListeners();
  const statusPresentationDelayFx = createStatusPresentationDelayController({ world, getFxTime });
  statusPresentationDelayFx.installListeners();

  const boltFx = createBoltFxController({ world, cam, fx, getPosition });
  boltFx.installListeners();

  const delayedDeathFx = createDelayedDeathFxController({ world, getFxTime, getPosition });
  delayedDeathFx.installListeners();

  const projectileFx = createProjectileFxController({ world, cam, fx, getPosition });
  projectileFx.installListeners();

  const ftext = new FloatText();
  try {
    /** @type any */ (window).float_text = (x, y, text, opts) => ftext.add(x, y, text, opts || {});
  } catch (e) { console.debug("[setupDisplayRuntime] float_text global setup failed:", e); }

  const spellAreaFx = createSpellAreaFxController({ world, cam, fx, PERF, getFxTime, getPosition, ftext, sculptFloor, sculptFloorBrush, getActiveReliefKey });
  spellAreaFx.installListeners();

  const cloudFx = createCloudFxController({ world, cam, fx, getFxTime, getPosition });
  cloudFx.installListeners();
  const surfaceAreaFx = createSurfaceAreaFxController({ getFxTime, classifySurfaceTile, fx, PERF });

  const deathEssenceFx = createDeathEssenceFxController({
    world,
    getFxTime,
    getPosition,
    getEntityIdentity,
    getEntityVitality,
  });
  deathEssenceFx.installListeners();

  const spiritWispFx = createSpiritWispFxController({ world, fx, getPosition, getPlayerEntity, sampleMood, deathEssenceFx });
  spiritWispFx.installListeners();

  const bumpFx = createBumpFxController();
  bumpFx.installListeners({ world, getPosition, isPlayer });

  const recoilFx = createRecoilFxController();
  recoilFx.installListeners({ world, getPosition, isPlayer });

  const hitstopFx = createHitstopController();
  hitstopFx.installListeners({ world, isPlayer });

  const deathVfx = createDeathVfxController();

  // ── Melee camera shake — scales with damage ───────────────────────
  world.on('damaged', ({ cause, amount, critical }) => {
    if (cause !== 'melee') return;
    const dmg = Number(amount) || 0;
    if (dmg < 1) return;
    // Amplitude: 1.0 at 1dmg, ramps to ~5 at 15+dmg, crits get 1.4x
    const base = 1.0 + Math.min(4.0, Math.log(1 + dmg / 2.5) * 2.2);
    const amp = critical ? base * 1.4 : base;
    // Duration: 0.06s baseline, scales gently with damage
    const dur = 0.06 + Math.min(0.10, dmg * 0.004);
    startShake(cam, amp, dur);
    // Crit zoom-punch: brief scale pulse that sells the weight of a big hit
    if (critical) startZoomPunch(cam, 0.025, 0.14);
  });

  const { goreTick } = installFloatTextWiring({ world, ftext, fx, getPosition, isVisibleAt, isPet, isPlayer, getFxTime });
  installEventUiWiring({
    world,
    ftext,
    getActiveSpellId,
    setActiveSpell,
    getPlayerEntity,
    getPosition,
    getItemInfo,
    resolveItemDisplayName,
    dispatchRulesAction,
  });

  return { statusEmitterFx, statusPresentationDelayFx, boltFx, delayedDeathFx, projectileFx, spellAreaFx, cloudFx, surfaceAreaFx, spiritWispFx, bumpFx, recoilFx, hitstopFx, deathEssenceFx, deathVfx, ftext, goreTick };
}
