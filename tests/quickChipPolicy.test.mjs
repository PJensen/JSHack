import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { Equipment } from "../src/rules/components/Equipment.js";
import { NamedIdentity } from "../src/rules/components/NamedIdentity.js";
import { shouldSuppressRecentPickupChipForEquippedDuplicate } from "../src/main/ui/quickChipPolicy.js";

function createItem(world, identity) {
  const id = world.create();
  world.set(id, NamedIdentity, { identity, name: identity });
  return id;
}

Deno.test("quick chip policy: suppresses chip for duplicate equipped ammo identity", () => {
  const world = new World({ seed: 1 });
  const playerId = world.create();
  const equippedAmmoId = createItem(world, "ammo_arrows");
  const recoveredAmmoId = createItem(world, "ammo_arrows");
  world.set(playerId, Equipment, { ammo: equippedAmmoId });

  assertEquals(
    shouldSuppressRecentPickupChipForEquippedDuplicate(world, playerId, recoveredAmmoId),
    true,
  );
});

Deno.test("quick chip policy: does not suppress when equipped ammo depleted", () => {
  const world = new World({ seed: 2 });
  const playerId = world.create();
  const recoveredAmmoId = createItem(world, "ammo_fire_arrows");
  world.set(playerId, Equipment, { ammo: null });

  assertEquals(
    shouldSuppressRecentPickupChipForEquippedDuplicate(world, playerId, recoveredAmmoId),
    false,
  );
});

Deno.test("quick chip policy: does not suppress for different ammo identity", () => {
  const world = new World({ seed: 3 });
  const playerId = world.create();
  const equippedAmmoId = createItem(world, "ammo_arrows");
  const recoveredAmmoId = createItem(world, "ammo_fire_arrows");
  world.set(playerId, Equipment, { ammo: equippedAmmoId });

  assertEquals(
    shouldSuppressRecentPickupChipForEquippedDuplicate(world, playerId, recoveredAmmoId),
    false,
  );
});

Deno.test("quick chip policy: suppresses duplicate identity for non-ammo equipped slots", () => {
  const world = new World({ seed: 4 });
  const playerId = world.create();
  const equippedHelmId = createItem(world, "helm_iron");
  const pickedUpHelmId = createItem(world, "helm_iron");
  world.set(playerId, Equipment, { head: equippedHelmId });

  assertEquals(
    shouldSuppressRecentPickupChipForEquippedDuplicate(world, playerId, pickedUpHelmId),
    true,
  );
});
