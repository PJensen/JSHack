import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { installSpeechBubbleWiring } from "../src/main/wiring/speechBubbleWiring.js";

Deno.test("speechBubbleWiring queues speech bubbles for nearby NPC dialogue", () => {
  const world = new World({ seed: 5 });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Position, { x: 4, y: 4 });

  const queued = [];
  const sounds = [];
  const sceneRuntime = {
    canActorAddressPlayer: (speakerId, maxDistance) => speakerId === 9 && maxDistance === 8,
    queueSpeechBubble: (bubble) => queued.push(bubble),
  };
  world.on("audio:play", (payload) => sounds.push(payload));

  installSpeechBubbleWiring({ world, sceneRuntime });
  world.emit("npc:dialogue", { actor: 9, text: "Keep your lamp trimmed." });

  assertEquals(queued.length, 1);
  assertEquals(queued[0].entityId, 9);
  assertEquals(queued[0].text, "Keep your lamp trimmed.");
  assertEquals(sounds.length, 1);
  assertEquals(sounds[0]?.id, "npc_hmm");
});

Deno.test("speechBubbleWiring ignores distant or empty NPC chatter", () => {
  const world = new World({ seed: 6 });
  const queued = [];
  const sounds = [];
  const sceneRuntime = {
    canActorAddressPlayer: () => false,
    queueSpeechBubble: (bubble) => queued.push(bubble),
  };
  world.on("audio:play", (payload) => sounds.push(payload));

  installSpeechBubbleWiring({ world, sceneRuntime });
  world.emit("npc:dialogue", { actor: 11, text: "Too far away." });
  world.emit("npc:dialogue", { actor: 11, text: "   " });

  assertEquals(queued.length, 0);
  assertEquals(sounds.length, 0);
});
