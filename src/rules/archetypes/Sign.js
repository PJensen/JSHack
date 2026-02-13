import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";

export const Sign = defineArchetype(
  "Sign",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [Interactable, { action: "readText", params: { textId: "<<TBD>>" } }],
  [Material, { kind: "wood" }]
);
