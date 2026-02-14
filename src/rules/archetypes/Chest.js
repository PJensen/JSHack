import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";
import { Inventory } from "../components/Inventory.js";

export const Chest = defineArchetype(
  "Chest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, { name: "Chest", identity: "chest" }],
  [Material, { kind: "iron" }],
  [Inventory, { items: [], capacity: 20, weightLimit: null }]
);
