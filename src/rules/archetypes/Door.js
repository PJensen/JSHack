import { defineArchetype } from "../Archetype.js";
import { Position } from "../components/Position.js";
import { DoorState } from "../components/DoorState.js";
import { Terrain } from "../components/Terrain.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";
import { Wood } from "./BaseMaterial.js";

export const Door = defineArchetype("Door",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [Material, { kind: "wood" }],
  [DoorState, { open: false, locked: false }],
  [Terrain, { walkable: false, opaque: true }],
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