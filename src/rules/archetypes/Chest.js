import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Inventory } from "../components/Inventory.js";

export const Chest = defineArchetype(
  "Chest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Chest", identity: "chest" }],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, { action: "openChest", params: { lootTable: "basic" } }],
  [Material, { kind: "iron" }],
  [Inventory, { items: [], capacity: 20, weightLimit: null }]
);
