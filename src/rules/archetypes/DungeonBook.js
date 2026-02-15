import { defineArchetype } from "../../lib/ecs-js/archetype.js";
import { Position } from "../components/Position.js";
import { Collider } from "../components/Collider.js";
import { Interactable } from "../components/Interactable.js";
import { Material } from "../components/Material.js";
import { NamedIdentity } from "../components/NamedIdentity.js";

/**
 * Decorative dungeon book — bump to read its flavor text.
 */
export const DungeonBook = defineArchetype(
  "DungeonBook",
  [Position, (p) => ({ x: p.x, y: p.y })],
  [NamedIdentity, (p) => ({ name: p.title || "Book", identity: "dungeon_book" })],
  [Collider, { solid: true, blocksSight: false }],
  [Interactable, (p) => ({ action: "readBook", params: { title: p.title || "Book", text: p.text || "" } })],
  [Material, { kind: "paper" }],
);
