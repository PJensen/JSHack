const INSTALLED = Symbol.for("jshack:main:speechBubbleWiring:installed");

/**
 * Route lightweight NPC chatter into the world-space speech bubble runtime.
 *
 * @param {{
 *   world: import("../../lib/ecs-js/index.js").World,
 *   sceneRuntime: { queueSpeechBubble: Function, canActorAddressPlayer: Function },
 * }} opts
 */
export function installSpeechBubbleWiring({ world, sceneRuntime }) {
  if (!world || !sceneRuntime) return;
  if (world[INSTALLED]) return;
  world[INSTALLED] = true;

  world.on("npc:dialogue", ({ actor, targetId, text }) => {
    const speakerId = Number(actor || targetId || 0) | 0;
    const line = String(text || "").trim();
    if (!(speakerId > 0) || !line) return;
    if (!sceneRuntime.canActorAddressPlayer(speakerId, 8)) return;
    world.emit("audio:play", { id: "npc_hmm" });
    sceneRuntime.queueSpeechBubble({
      entityId: speakerId,
      text: line,
      durationSec: Math.max(2.6, Math.min(5.2, 1.4 + (line.length * 0.045))),
    });
  });
}
