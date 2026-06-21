export default {
  "name": "herbalist_hut",
  "keystone": {
    "x": 2,
    "y": 4
  },
  "width": 5,
  "height": 6,
  "tiles": [
    { "dx": -2, "dy": -4, "tile": "wall" },
    { "dx": -1, "dy": -4, "tile": "wall" },
    { "dx": 0, "dy": -4, "tile": "wall" },
    { "dx": 1, "dy": -4, "tile": "wall" },
    { "dx": 2, "dy": -4, "tile": "wall" },

    { "dx": -2, "dy": -3, "tile": "wall" },
    { "dx": -1, "dy": -3, "tile": "floor" },
    { "dx": 0, "dy": -3, "tile": "floor" },
    { "dx": 1, "dy": -3, "tile": "floor" },
    { "dx": 2, "dy": -3, "tile": "wall" },

    { "dx": -2, "dy": -2, "tile": "wall" },
    { "dx": -1, "dy": -2, "tile": "floor" },
    { "dx": 0, "dy": -2, "tile": "floor" },
    { "dx": 1, "dy": -2, "tile": "floor" },
    { "dx": 2, "dy": -2, "tile": "wall" },

    { "dx": -2, "dy": -1, "tile": "wall" },
    { "dx": -1, "dy": -1, "tile": "floor" },
    { "dx": 0, "dy": -1, "tile": "floor" },
    { "dx": 1, "dy": -1, "tile": "floor" },
    { "dx": 2, "dy": -1, "tile": "wall" },

    { "dx": -2, "dy": 0, "tile": "grass" },
    { "dx": -1, "dy": 0, "tile": "wall" },
    { "dx": 0, "dy": 0, "tile": "door" },
    { "dx": 1, "dy": 0, "tile": "wall" },
    { "dx": 2, "dy": 0, "tile": "grass" },

    { "dx": -2, "dy": 1, "tile": "grass" },
    { "dx": -1, "dy": 1, "tile": "grass" },
    { "dx": 0, "dy": 1, "tile": "cobblestone" },
    { "dx": 1, "dy": 1, "tile": "grass" },
    { "dx": 2, "dy": 1, "tile": "grass" }
  ],
  "spawns": [
    {
      "dx": -1,
      "dy": -3,
      "kind": "home_bed"
    },
    {
      "dx": 1,
      "dy": -3,
      "kind": "crate"
    },
    {
      "dx": -2,
      "dy": -2,
      "kind": "window_rect"
    },
    {
      "dx": 1,
      "dy": -2,
      "kind": "herb_chest"
    },
    {
      "dx": -2,
      "dy": 0,
      "kind": "flower_daisy"
    },
    {
      "dx": 2,
      "dy": 0,
      "kind": "flower_sunflower"
    }
  ],
  "waypoints": [
    {
      "dx": 1,
      "dy": -2,
      "name": "herb_work"
    },
    {
      "dx": 0,
      "dy": -2,
      "name": "resident_home"
    },
    {
      "dx": 0,
      "dy": 0,
      "name": "front_door"
    }
  ]
};
