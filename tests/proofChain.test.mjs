import { assertEquals, assert } from "jsr:@std/assert";
import { createGameProof } from "../src/cloud/proof/gameProof.js";
import { verifyHashChain } from "../src/cloud/proof/proofVerify.js";

// ---------------------------------------------------------------------------
// gameProof basics
// ---------------------------------------------------------------------------
Deno.test("createGameProof initializes with nonce and empty actions", async () => {
  const proof = createGameProof(0xC0FFEE);
  await proof.ready;
  const b = proof.getBundle();
  assertEquals(b.seed, 0xC0FFEE);
  assert(typeof b.nonce === "string" && b.nonce.length > 0, "nonce should be non-empty");
  assertEquals(b.actions.length, 0);
  assertEquals(proof.getActionCount(), 0);
});

Deno.test("record adds actions to the bundle", async () => {
  const proof = createGameProof(42);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 1, dy: 0 });
  proof.record(1, "rules.wait", {});
  assertEquals(proof.getActionCount(), 2);
  const b = proof.getBundle();
  assertEquals(b.actions[0].type, "rules.move");
  assertEquals(b.actions[1].type, "rules.wait");
  // Await pending hash catch-up to avoid leak.
  await proof.finalize({ score: 0, depth: 0, turns: 0 });
});

// ---------------------------------------------------------------------------
// finalize + hash chain
// ---------------------------------------------------------------------------
Deno.test("finalize produces a valid hex chainHash", async () => {
  const proof = createGameProof(42);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 1, dy: 0 });
  proof.record(1, "rules.wait", {});
  const bundle = await proof.finalize({ score: 100, depth: 3, turns: 2 });
  assert(typeof bundle.chainHash === "string", "chainHash should be a string");
  assert(/^[0-9a-f]{64}$/.test(bundle.chainHash), "chainHash should be 64 hex chars");
  assertEquals(bundle.score, 100);
  assertEquals(bundle.depth, 3);
  assertEquals(bundle.turns, 2);
  assert(bundle.timestamp !== null, "timestamp should be set");
});

Deno.test("hash chain is deterministic for same seed+nonce+actions", async () => {
  const proof = createGameProof(42);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 1, dy: 0 });
  const bundle1 = await proof.finalize({ score: 10, depth: 1, turns: 1 });
  // Second finalize should return same bundle (idempotent).
  const bundle2 = await proof.finalize({ score: 999, depth: 99, turns: 99 });
  assertEquals(bundle1.chainHash, bundle2.chainHash);
  // Score should remain from first finalize.
  assertEquals(bundle2.score, 10);
});

Deno.test("record after finalize is ignored", async () => {
  const proof = createGameProof(42);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 1, dy: 0 });
  await proof.finalize({ score: 10, depth: 1, turns: 1 });
  proof.record(1, "rules.wait", {});
  assertEquals(proof.getActionCount(), 1, "should not add action after finalize");
});

Deno.test("resumedFromSave flag is set", async () => {
  const proof = createGameProof(42, { resumedFromSave: true });
  await proof.ready;
  assertEquals(proof.getBundle().resumedFromSave, true);
  await proof.finalize({ score: 0, depth: 0, turns: 0 });
});

// ---------------------------------------------------------------------------
// verifyHashChain
// ---------------------------------------------------------------------------
Deno.test("verifyHashChain passes for a valid proof bundle", async () => {
  const proof = createGameProof(0xBEEF);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 0, dy: 1 });
  proof.record(1, "rules.move", { dx: 1, dy: 0 });
  proof.record(2, "rules.wait", {});
  const bundle = await proof.finalize({ score: 50, depth: 2, turns: 3 });

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);
});

Deno.test("verifyHashChain fails when an action is tampered", async () => {
  const proof = createGameProof(0xBEEF);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 0, dy: 1 });
  proof.record(1, "rules.move", { dx: 1, dy: 0 });
  const bundle = await proof.finalize({ score: 50, depth: 2, turns: 2 });

  bundle.actions[0].payload.dx = 999;

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("chain hash mismatch")));
});

Deno.test("verifyHashChain fails when an extra action is inserted", async () => {
  const proof = createGameProof(0xBEEF);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 0, dy: 1 });
  const bundle = await proof.finalize({ score: 10, depth: 1, turns: 1 });

  bundle.actions.push({ turn: 1, type: "rules.wait", payload: {} });

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("chain hash mismatch")));
});

Deno.test("verifyHashChain fails when an action is removed", async () => {
  const proof = createGameProof(0xBEEF);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 0, dy: 1 });
  proof.record(1, "rules.wait", {});
  const bundle = await proof.finalize({ score: 10, depth: 1, turns: 2 });

  bundle.actions.pop();

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("chain hash mismatch")));
});

Deno.test("verifyHashChain fails when nonce is changed", async () => {
  const proof = createGameProof(0xBEEF);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 1, dy: 0 });
  const bundle = await proof.finalize({ score: 10, depth: 1, turns: 1 });

  bundle.nonce = "dGFtcGVyZWQ=";

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, false);
});

Deno.test("verifyHashChain fails when seed is changed", async () => {
  const proof = createGameProof(0xBEEF);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 1, dy: 0 });
  const bundle = await proof.finalize({ score: 10, depth: 1, turns: 1 });

  bundle.seed = 0xDEAD;

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, false);
});

Deno.test("verifyHashChain fails for unfinalized bundle (null chainHash)", async () => {
  const proof = createGameProof(42);
  await proof.ready;
  proof.record(0, "rules.move", { dx: 1, dy: 0 });
  const bundle = proof.getBundle();

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, false);
  assert(result.errors.some(e => e.includes("null")));
  // Clean up pending hash operations.
  await proof.finalize({ score: 0, depth: 0, turns: 0 });
});

Deno.test("verifyHashChain passes for empty action log", async () => {
  const proof = createGameProof(42);
  await proof.ready;
  const bundle = await proof.finalize({ score: 0, depth: 0, turns: 0 });

  const result = await verifyHashChain(bundle);
  assertEquals(result.valid, true, `Expected valid but got errors: ${result.errors.join(", ")}`);
});
