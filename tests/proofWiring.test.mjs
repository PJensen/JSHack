import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { installProofWiring } from "../src/main/proof/proofWiring.js";
import { verifyHashChain } from "../src/shared/proofVerify.js";
import { Player } from "../src/rules/components/Player.js";
import { Score } from "../src/rules/components/Score.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { DungeonState } from "../src/rules/components/DungeonState.js";

function makeTestWorld(seed = 42) {
  const world = new World({ seed });
  const playerId = world.create();
  world.add(playerId, Player, {});
  world.add(playerId, Score, { current: 0 });
  world.add(playerId, NamedIdentity, { name: "TestHero", identity: "player_warden" });

  const dungeonId = world.create();
  world.add(dungeonId, DungeonState, {
    seed,
    worldSeed: seed,
    currentDepth: 3,
    currentChunkX: 0,
    currentChunkY: 0,
    floorEntityIds: [],
    spawnChunkX: 0,
    spawnChunkY: 0,
  });
  return { world, playerId, dungeonId };
}

// ---------------------------------------------------------------------------
// installProofWiring
// ---------------------------------------------------------------------------
Deno.test("installProofWiring installs once (Symbol guard)", () => {
  const { world } = makeTestWorld();
  const w1 = installProofWiring({ world });
  const w2 = installProofWiring({ world });
  assert(typeof w1.recordAction === "function");
  // Second install returns noop.
  assertEquals(w2.getProof(), null);
});

Deno.test({ name: "recordAction captures move actions", sanitizeOps: false, fn() {
  const { world } = makeTestWorld();
  const wiring = installProofWiring({ world });
  wiring.recordAction(0, "rules.move", { dx: 1, dy: 0 });
  wiring.recordAction(1, "rules.wait", {});
  // Proof is not finalized yet — getProof returns null.
  assertEquals(wiring.getProof(), null);
}});

// ---------------------------------------------------------------------------
// proof:ready on player death
// ---------------------------------------------------------------------------
Deno.test({ name: "proof:ready fires on player death with valid bundle", sanitizeOps: false, async fn() {
  const { world, playerId } = makeTestWorld(0xBEEF);

  // Set up score.
  const sc = world.get(playerId, Score);
  sc.current = 250;

  const wiring = installProofWiring({ world });

  // Record some actions.
  wiring.recordAction(0, "rules.move", { dx: 1, dy: 0 });
  wiring.recordAction(1, "rules.move", { dx: 0, dy: 1 });
  wiring.recordAction(2, "rules.wait", {});

  // Listen for proof:ready.
  let receivedBundle = null;
  world.on("proof:ready", ({ bundle }) => { receivedBundle = bundle; });

  // Emit player death.
  world.emit("died", { id: playerId, killer: 0, cause: "test" });

  // proof:ready fires asynchronously (after finalize resolves).
  // Wait for the promise chain to flush.
  await new Promise((r) => setTimeout(r, 50));

  assert(receivedBundle !== null, "proof:ready should have fired");
  assertEquals(receivedBundle.seed, 0xBEEF);
  assertEquals(receivedBundle.score, 250);
  assertEquals(receivedBundle.depth, 3);
  assertEquals(receivedBundle.actions.length, 3);
  assertEquals(receivedBundle.playerName, "TestHero");
  assertEquals(receivedBundle.playerClass, "Warden");
  assert(/^[0-9a-f]{64}$/.test(receivedBundle.chainHash), "should have valid chainHash");

  // Verify the hash chain.
  const result = await verifyHashChain(receivedBundle);
  assertEquals(result.valid, true, `hash chain invalid: ${result.errors.join(", ")}`);
}});

Deno.test({ name: "proof:ready does not fire for non-player death", sanitizeOps: false, async fn() {
  const { world } = makeTestWorld();
  const wiring = installProofWiring({ world });
  wiring.recordAction(0, "rules.move", { dx: 1, dy: 0 });

  let fired = false;
  world.on("proof:ready", () => { fired = true; });

  // Create a non-player entity.
  const monsterId = world.create();
  world.add(monsterId, NamedIdentity, { name: "Goblin", identity: "goblin" });
  world.emit("died", { id: monsterId, killer: 0, cause: "test" });

  await new Promise((r) => setTimeout(r, 50));
  assertEquals(fired, false, "proof:ready should not fire for non-player death");
}});

Deno.test({ name: "getProof returns bundle after death", sanitizeOps: false, async fn() {
  const { world, playerId } = makeTestWorld(0xCAFE);
  const wiring = installProofWiring({ world });
  wiring.recordAction(0, "rules.wait", {});

  world.emit("died", { id: playerId, killer: 0, cause: "test" });
  await new Promise((r) => setTimeout(r, 50));

  const proof = wiring.getProof();
  assert(proof !== null, "getProof should return the bundle after death");
  assertEquals(proof.seed, 0xCAFE);
}});

Deno.test({ name: "resetForLoad creates fresh recorder with resumedFromSave", sanitizeOps: false, async fn() {
  const { world, playerId } = makeTestWorld(0xFACE);
  const wiring = installProofWiring({ world });

  // Record some actions before "save".
  wiring.recordAction(0, "rules.move", { dx: 1, dy: 0 });
  wiring.recordAction(1, "rules.move", { dx: 0, dy: 1 });

  // Simulate loading a save — resets recorder.
  wiring.resetForLoad();

  // Record post-load actions.
  wiring.recordAction(5, "rules.wait", {});

  // Trigger death.
  let receivedBundle = null;
  world.on("proof:ready", ({ bundle }) => { receivedBundle = bundle; });
  world.emit("died", { id: playerId, killer: 0, cause: "test" });
  await new Promise((r) => setTimeout(r, 50));

  assert(receivedBundle !== null, "should get proof after reset+death");
  assertEquals(receivedBundle.resumedFromSave, true);
  // Only the post-load action should be in the log.
  assertEquals(receivedBundle.actions.length, 1);
  assertEquals(receivedBundle.actions[0].type, "rules.wait");

  const result = await verifyHashChain(receivedBundle);
  assertEquals(result.valid, true, `chain invalid after reset: ${result.errors.join(", ")}`);
}});
