import { defineExtension } from "../../lib/ecs-js/index.js";
import { Teleported } from "../../events/Teleported.js";
import { jumpTo } from "../camera/utils.js";

const TELEPORT_FX_EXTENSION_KEY = Symbol.for("jshack:display:teleportFx");
const TELEPORT_REVEAL_SECONDS = 0.52;
const TELEPORT_HOLD_SECONDS = 0.08;

export function teleportVeilAlpha(elapsed) {
  const t = Math.max(0, Number(elapsed) || 0);
  if (t <= TELEPORT_HOLD_SECONDS) return 1;
  const reveal = Math.min(1, (t - TELEPORT_HOLD_SECONDS) / (TELEPORT_REVEAL_SECONDS - TELEPORT_HOLD_SECONDS));
  return (1 - reveal) * (1 - reveal);
}

export function createTeleportFxController({ world, cam, isPlayer }) {
  let elapsed = Infinity;

  function onTeleported({ id, to }) {
    const actorId = Number(id || 0) | 0;
    if (!(actorId > 0) || (typeof isPlayer === "function" && !isPlayer(actorId))) return;
    const x = Number(to?.x);
    const y = Number(to?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) jumpTo(cam, { x, y });
    elapsed = 0;
  }

  const extension = defineExtension("jshack:display:teleportFx", (installedWorld) => {
    const offTyped = installedWorld.on(Teleported, onTeleported);
    const offLegacy = installedWorld.on("teleported", onTeleported);
    return () => { offTyped(); offLegacy(); };
  }, { key: TELEPORT_FX_EXTENSION_KEY });

  world.install(extension);

  return {
    tick(dt) {
      if (!Number.isFinite(elapsed)) return;
      elapsed += Math.max(0, Number(dt) || 0);
      if (elapsed >= TELEPORT_REVEAL_SECONDS) elapsed = Infinity;
    },
    draw(ctx, width, height) {
      const alpha = teleportVeilAlpha(elapsed);
      if (!(alpha > 0)) return;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = `rgba(8, 4, 20, ${alpha.toFixed(3)})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
    },
    get active() {
      return Number.isFinite(elapsed);
    },
  };
}
