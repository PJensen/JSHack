// Dark shrine room — fluorite gem center, kobold shamans hidden in the dark.
// Single south entrance. No torches — gem is invisible until lightning charges it.
// Swarm trap just inside the entrance: step in → ambush. Shamans pre-placed at flanks + rear.
//
// Layout (9×9, single entrance south center):
//
//   # # # # # # # # #
//   # . . . . . . . #
//   # . S . . . S . #   S = shaman
//   # . . . * . . . #   * = gem
//   # . . . . . . . #
//   # . . . S . . . #   S = shaman (rear guard)
//   # . . . . . . . #
//   # . . . T . . . #   T = swarm trap
//   # # # # . # # # #   . = entrance

export default {
  name: "room_shaman_dark_shrine",
  tiles: [
    // dy = -4 (north wall)
    { dx: -4, dy: -4, tile: "wall" },
    { dx: -3, dy: -4, tile: "wall" },
    { dx: -2, dy: -4, tile: "wall" },
    { dx: -1, dy: -4, tile: "wall" },
    { dx:  0, dy: -4, tile: "wall" },
    { dx:  1, dy: -4, tile: "wall" },
    { dx:  2, dy: -4, tile: "wall" },
    { dx:  3, dy: -4, tile: "wall" },
    { dx:  4, dy: -4, tile: "wall" },
    // dy = -3
    { dx: -4, dy: -3, tile: "wall" },
    { dx: -3, dy: -3, tile: "floor" },
    { dx: -2, dy: -3, tile: "floor" },
    { dx: -1, dy: -3, tile: "floor" },
    { dx:  0, dy: -3, tile: "floor" },
    { dx:  1, dy: -3, tile: "floor" },
    { dx:  2, dy: -3, tile: "floor" },
    { dx:  3, dy: -3, tile: "floor" },
    { dx:  4, dy: -3, tile: "wall" },
    // dy = -2
    { dx: -4, dy: -2, tile: "wall" },
    { dx: -3, dy: -2, tile: "floor" },
    { dx: -2, dy: -2, tile: "floor" },
    { dx: -1, dy: -2, tile: "floor" },
    { dx:  0, dy: -2, tile: "floor" },
    { dx:  1, dy: -2, tile: "floor" },
    { dx:  2, dy: -2, tile: "floor" },
    { dx:  3, dy: -2, tile: "floor" },
    { dx:  4, dy: -2, tile: "wall" },
    // dy = -1
    { dx: -4, dy: -1, tile: "wall" },
    { dx: -3, dy: -1, tile: "floor" },
    { dx: -2, dy: -1, tile: "floor" },
    { dx: -1, dy: -1, tile: "floor" },
    { dx:  0, dy: -1, tile: "floor" },
    { dx:  1, dy: -1, tile: "floor" },
    { dx:  2, dy: -1, tile: "floor" },
    { dx:  3, dy: -1, tile: "floor" },
    { dx:  4, dy: -1, tile: "wall" },
    // dy = 0
    { dx: -4, dy:  0, tile: "wall" },
    { dx: -3, dy:  0, tile: "floor" },
    { dx: -2, dy:  0, tile: "floor" },
    { dx: -1, dy:  0, tile: "floor" },
    { dx:  0, dy:  0, tile: "floor" },
    { dx:  1, dy:  0, tile: "floor" },
    { dx:  2, dy:  0, tile: "floor" },
    { dx:  3, dy:  0, tile: "floor" },
    { dx:  4, dy:  0, tile: "wall" },
    // dy = +1
    { dx: -4, dy:  1, tile: "wall" },
    { dx: -3, dy:  1, tile: "floor" },
    { dx: -2, dy:  1, tile: "floor" },
    { dx: -1, dy:  1, tile: "floor" },
    { dx:  0, dy:  1, tile: "floor" },
    { dx:  1, dy:  1, tile: "floor" },
    { dx:  2, dy:  1, tile: "floor" },
    { dx:  3, dy:  1, tile: "floor" },
    { dx:  4, dy:  1, tile: "wall" },
    // dy = +2
    { dx: -4, dy:  2, tile: "wall" },
    { dx: -3, dy:  2, tile: "floor" },
    { dx: -2, dy:  2, tile: "floor" },
    { dx: -1, dy:  2, tile: "floor" },
    { dx:  0, dy:  2, tile: "floor" },
    { dx:  1, dy:  2, tile: "floor" },
    { dx:  2, dy:  2, tile: "floor" },
    { dx:  3, dy:  2, tile: "floor" },
    { dx:  4, dy:  2, tile: "wall" },
    // dy = +3
    { dx: -4, dy:  3, tile: "wall" },
    { dx: -3, dy:  3, tile: "floor" },
    { dx: -2, dy:  3, tile: "floor" },
    { dx: -1, dy:  3, tile: "floor" },
    { dx:  0, dy:  3, tile: "floor" },
    { dx:  1, dy:  3, tile: "floor" },
    { dx:  2, dy:  3, tile: "floor" },
    { dx:  3, dy:  3, tile: "floor" },
    { dx:  4, dy:  3, tile: "wall" },
    // dy = +4 (south wall with entrance gap at dx=0)
    { dx: -4, dy:  4, tile: "wall" },
    { dx: -3, dy:  4, tile: "wall" },
    { dx: -2, dy:  4, tile: "wall" },
    { dx: -1, dy:  4, tile: "wall" },
    { dx:  0, dy:  4, tile: "floor" },
    { dx:  1, dy:  4, tile: "wall" },
    { dx:  2, dy:  4, tile: "wall" },
    { dx:  3, dy:  4, tile: "wall" },
    { dx:  4, dy:  4, tile: "wall" },
  ],
  spawns: [
    // Fluorite gem — center of the room. Dark until lightning hits it.
    { dx:  0, dy: -1, kind: "catalog_item", params: { itemId: "gem_fluorite" } },
    // Pre-placed shamans — flanking the gem from the north corners
    { dx: -2, dy: -2, kind: "monster", params: { monsterId: "kobold_shaman" } },
    { dx:  2, dy: -2, kind: "monster", params: { monsterId: "kobold_shaman" } },
    // Rear guard — deep north, last line of fire
    { dx:  0, dy: -3, kind: "monster", params: { monsterId: "kobold_shaman" } },
    // Proximity trap — pressure plate just inside the entrance.
    // Triggers on first step in: spawns 2 more shamans around the trap.
    { dx:  0, dy:  2, kind: "trap", params: { type: "swarm", params: { monsterId: "kobold_shaman", count: 2 } } },
  ],
  waypoints: [
    { dx: 0, dy: 4, name: "entrance", connect: true },
  ],
};
