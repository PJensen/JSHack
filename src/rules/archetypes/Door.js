import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { DoorState } from "../components/DoorState.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";

export const Door = defineArchetype("Door",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [Material, { kind: "wood" }],
  [DoorState, { open: false, locked: false }],
  [Collider, { solid: true, blocksSight: true }],
  [Interactable, { action: "toggleDoor" }],
);

// Chest
export const Chest = defineArchetype(
  "Chest",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [Interactable, { action: "openChest", params: { lootTable: "basic" } }],
  [Material, { kind: "iron" }]
);

// Sign
export const Sign = defineArchetype(
  "Sign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [Interactable, { action: "readText", params: { textId: "<<TBD>>" } }],
  [Material, { kind: "wood" }]
);