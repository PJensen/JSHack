import { FloatText } from "../passes/vfx/text/floatText.js";
import { createStatusEmitterController } from "../passes/vfx/particles/statusEmitterController.js";
import { createBoltFxController } from "../fx/boltFxController.js";
import { createProjectileFxController } from "../fx/projectileFx.js";
import { createSpellAreaFxController } from "../fx/spellAreaFx.js";
import { createCloudFxController } from "../fx/cloudFx.js";
import { installFloatTextWiring } from "../ui/wiring/floatTextWiring.js";
import { installEventUiWiring } from "../ui/wiring/eventUiWiring.js";

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
  isVisibleAt,
  isPet,
  isPlayer,
  getPlayerEntity,
  getItemInfo,
  resolveItemDisplayName,
  dispatchRulesAction,
}) {
  const statusEmitterFx = createStatusEmitterController({ world, fx });
  statusEmitterFx.installListeners();

  const boltFx = createBoltFxController({ world, cam, fx, getPosition });
  boltFx.installListeners();

  const projectileFx = createProjectileFxController({ world, cam, fx, getPosition });
  projectileFx.installListeners();

  const spellAreaFx = createSpellAreaFxController({ world, cam, fx, PERF, getFxTime });
  spellAreaFx.installListeners();

  const cloudFx = createCloudFxController({ world, cam, fx, getFxTime, getPosition });
  cloudFx.installListeners();

  const ftext = new FloatText();
  try {
    /** @type any */ (window).float_text = (x, y, text, opts) => ftext.add(x, y, text, opts || {});
  } catch (e) { console.debug("[setupDisplayRuntime] float_text global setup failed:", e); }

  installFloatTextWiring({ world, ftext, fx, getPosition, isVisibleAt, isPet, isPlayer });
  installEventUiWiring({
    world,
    ftext,
    getActiveSpellId,
    setActiveSpell,
    getPlayerEntity,
    getItemInfo,
    resolveItemDisplayName,
    dispatchRulesAction,
  });

  return { statusEmitterFx, boltFx, projectileFx, spellAreaFx, cloudFx, ftext };
}
