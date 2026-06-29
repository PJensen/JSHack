// General store: arms, armor, potions, food, tools (touchstone, pickaxe).
// Same 8×7 shell as gem_store / book_shop. Door faces south (anchor = door).
// Static shop — browseable floor items, no live vendor NPC.
export default {
  "name": "general_store",
  "keystone": { "x": 3, "y": 5 },
  "width": 8,
  "height": 7,
  "tiles": [
    { "dx": -3, "dy": -5, "tile": "wall" },
    { "dx": -2, "dy": -5, "tile": "wall" },
    { "dx": -1, "dy": -5, "tile": "wall" },
    { "dx":  0, "dy": -5, "tile": "wall" },
    { "dx":  1, "dy": -5, "tile": "wall" },
    { "dx":  2, "dy": -5, "tile": "wall" },
    { "dx":  3, "dy": -5, "tile": "wall" },
    { "dx":  4, "dy": -5, "tile": "wall" },

    { "dx": -3, "dy": -4, "tile": "wall" },
    { "dx": -2, "dy": -4, "tile": "floor" },
    { "dx": -1, "dy": -4, "tile": "floor" },
    { "dx":  0, "dy": -4, "tile": "floor" },
    { "dx":  1, "dy": -4, "tile": "floor" },
    { "dx":  2, "dy": -4, "tile": "floor" },
    { "dx":  3, "dy": -4, "tile": "floor" },
    { "dx":  4, "dy": -4, "tile": "wall" },

    { "dx": -3, "dy": -3, "tile": "wall" },
    { "dx": -2, "dy": -3, "tile": "floor" },
    { "dx": -1, "dy": -3, "tile": "floor" },
    { "dx":  0, "dy": -3, "tile": "floor" },
    { "dx":  1, "dy": -3, "tile": "floor" },
    { "dx":  2, "dy": -3, "tile": "floor" },
    { "dx":  3, "dy": -3, "tile": "floor" },
    { "dx":  4, "dy": -3, "tile": "wall" },

    { "dx": -3, "dy": -2, "tile": "wall" },
    { "dx": -2, "dy": -2, "tile": "floor" },
    { "dx": -1, "dy": -2, "tile": "floor" },
    { "dx":  0, "dy": -2, "tile": "floor" },
    { "dx":  1, "dy": -2, "tile": "floor" },
    { "dx":  2, "dy": -2, "tile": "floor" },
    { "dx":  3, "dy": -2, "tile": "floor" },
    { "dx":  4, "dy": -2, "tile": "wall" },

    { "dx": -3, "dy": -1, "tile": "wall" },
    { "dx": -2, "dy": -1, "tile": "floor" },
    { "dx": -1, "dy": -1, "tile": "floor" },
    { "dx":  0, "dy": -1, "tile": "floor" },
    { "dx":  1, "dy": -1, "tile": "floor" },
    { "dx":  2, "dy": -1, "tile": "floor" },
    { "dx":  3, "dy": -1, "tile": "floor" },
    { "dx":  4, "dy": -1, "tile": "wall" },

    { "dx": -3, "dy":  0, "tile": "wall" },
    { "dx": -2, "dy":  0, "tile": "wall" },
    { "dx": -1, "dy":  0, "tile": "wall" },
    { "dx":  0, "dy":  0, "tile": "door" },
    { "dx":  1, "dy":  0, "tile": "wall" },
    { "dx":  2, "dy":  0, "tile": "wall" },
    { "dx":  3, "dy":  0, "tile": "wall" },
    { "dx":  4, "dy":  0, "tile": "wall" }
  ],
  "spawns": [
    { "dx": -2, "dy": -4, "kind": "weapon_rack" },
    { "dx":  2, "dy": -4, "kind": "weapon_rack" },
    { "dx": -1, "dy": -3, "kind": "general_store_item" },
    { "dx":  1, "dy": -3, "kind": "general_store_item" },
    { "dx":  3, "dy": -3, "kind": "general_store_item" },
    { "dx": -2, "dy": -2, "kind": "general_store_item" },
    { "dx":  0, "dy": -2, "kind": "general_store_item" },
    { "dx":  3, "dy": -2, "kind": "general_store_item" },
    { "dx":  3, "dy": -1, "kind": "home_bed" },
    { "dx":  2, "dy":  1, "kind": "general_store_sign" }
  ],
  "waypoints": [
    { "dx":  0, "dy":  0, "name": "shop_door" },
    { "dx":  0, "dy": -2, "name": "vendor_work" }
  ],
  "rooms": [
    { "name": "shop", "roomType": "shop", "dx": -3, "dy": -5, "w": 8, "h": 6 }
  ],
  "shop": {
    "vendorRole": "general_vendor",
    "doorWaypoint": "shop_door",
    "workWaypoint": "vendor_work",
    "room": "shop"
  }
};
