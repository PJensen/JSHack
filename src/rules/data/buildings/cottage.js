export default {
  "name": "cottage",
  "keystone": { "x": 2, "y": 4 },
  "width": 5,
  "height": 5,
  "tiles": [
    // dy=-4: north wall
    { "dx": 0, "dy": -4, "tile": "wall" },
    { "dx": 1, "dy": -4, "tile": "wall" },
    { "dx": 2, "dy": -4, "tile": "wall" },
    { "dx": 3, "dy": -4, "tile": "wall" },
    { "dx": 4, "dy": -4, "tile": "wall" },
    // dy=-3
    { "dx": 0, "dy": -3, "tile": "wall" },
    { "dx": 1, "dy": -3, "tile": "floor" },
    { "dx": 2, "dy": -3, "tile": "floor" },
    { "dx": 3, "dy": -3, "tile": "floor" },
    { "dx": 4, "dy": -3, "tile": "wall" },
    // dy=-2
    { "dx": 0, "dy": -2, "tile": "wall" },
    { "dx": 1, "dy": -2, "tile": "floor" },
    { "dx": 2, "dy": -2, "tile": "floor" },
    { "dx": 3, "dy": -2, "tile": "floor" },
    { "dx": 4, "dy": -2, "tile": "wall" },
    // dy=-1
    { "dx": 0, "dy": -1, "tile": "wall" },
    { "dx": 1, "dy": -1, "tile": "floor" },
    { "dx": 2, "dy": -1, "tile": "floor" },
    { "dx": 3, "dy": -1, "tile": "floor" },
    { "dx": 4, "dy": -1, "tile": "wall" },
    // dy=0: south wall with door (anchor)
    { "dx": 0, "dy": 0, "tile": "wall" },
    { "dx": 1, "dy": 0, "tile": "wall" },
    { "dx": 2, "dy": 0, "tile": "door" },
    { "dx": 3, "dy": 0, "tile": "wall" },
    { "dx": 4, "dy": 0, "tile": "wall" }
  ],
  "spawns": [
    { "dx": 1, "dy": -2, "kind": "home_bed" }
  ],
  "waypoints": [
    { "dx": 2, "dy": 0, "name": "shop_door" },
    { "dx": 2, "dy": -2, "name": "vendor_work" }
  ]
};
