# Town Economy

Classical view: raw inputs enter the town through labor and harvest nodes, move
through storage chests, then become intermediate goods, tools, medicine, meals,
and town-state signals.

```mermaid
flowchart LR
  subgraph RawInputs["Raw inputs"]
    Crops["Wheat / carrots / corn"]
    Trees["Trees"]
    OreNodes["Ore + coal nodes"]
    Herbs["Herbs + reagents"]
    Water["Well water"]
    Fish["Fishable water"]
  end

  subgraph Labor["Town labor"]
    Farmer["Farmer"]
    Woodcutter["Woodcutter"]
    Miner["Miner"]
    Herbalist["Herbalist"]
    Fisher["Fisher"]
    Villager["Villager hauler"]
    Smith["Smith"]
    Barkeep["Barkeep"]
    Alchemist["Alchemist"]
    Mason["Mason"]
  end

  subgraph Stores["Storage chests"]
    MillChest["Mill Chest"]
    LumberChest["Lumber Chest"]
    SmithyChest["Smithy Chest"]
    HerbChest["Herb Chest"]
    TavernChest["Tavern Chest"]
    Shops["Shop stock"]
  end

  subgraph Outputs["Outputs"]
    Flour["Flour"]
    Iron["Iron ingots"]
    Tools["Kitchen knife / hatchet / pickaxe / shields / weapons"]
    Stew["Town stew"]
    Potions["Potions"]
    Repairs["Repaired town tiles"]
  end

  Crops --> Farmer --> MillChest --> Flour
  Trees --> Woodcutter --> LumberChest
  OreNodes --> Miner --> SmithyChest --> Iron
  Herbs --> Herbalist --> HerbChest
  Water --> Villager --> TavernChest
  Fish --> Fisher --> TavernChest

  Flour --> Villager --> TavernChest
  LumberChest --> Villager --> SmithyChest
  LumberChest --> Villager --> TavernChest

  Iron --> SmithyChest
  SmithyChest --> Smith --> Tools
  TavernChest --> Barkeep --> Stew
  HerbChest --> Alchemist --> Potions --> Shops
  LumberChest --> Mason --> Repairs
  SmithyChest --> Mason

  MillChest --> FoodStores["TownState.foodStores"]
  TavernChest --> FoodStores
  SmithyChest --> MaterialStores["TownState.materialStores"]
  LumberChest --> MaterialStores
  HerbChest --> MedicineStores["TownState.medicineStores"]
  Shops --> MedicineStores

  FoodStores --> Morale["Town morale + shortages"]
  MaterialStores --> Morale
  MedicineStores --> Morale
  Repairs --> Morale
```

Current production rules:

- Mill: `food_wheat` becomes `food_flour`.
- Furnace: `ore_iron` plus `ore_coal` becomes `material_iron`.
- Smithy: `material_iron` plus `material_lumber` becomes town tools and gear.
- Tavern: `food_flour` or `food_raw_fish` plus `fuel_firewood`, with reusable
  `water_bucket` and `tool_kitchen_knife`, becomes `food_stew`.
- Alchemist: herb chest reagents can become shop potion stock.

Observed bottlenecks to watch:

- Goods only produce when inputs land in the correct chest.
- Reusable kitchen tools and water buckets gate stew production.
- Lumber is split between smithing, tavern fuel, and repairs.
- The town keeps a visible prepared-meal reserve, so stew should not drain to
  zero just because townsfolk eat.

Future passes:

- Add more advanced smithing recipes.
- Give Town Stew its own food effect while keeping the item icon.
- Add a trinket gear slot.
