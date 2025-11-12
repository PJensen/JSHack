export function createFloorActivationSystem({
  dungeonLevelComponent,
  onUpdate,
} = {}) {
  if (!dungeonLevelComponent) {
    throw new Error("FloorActivationSystem requires dungeonLevelComponent");
  }
  const pausedFloors = new Map();
  const notify = typeof onUpdate === "function" ? onUpdate : null;

  return function floorActivationSystem(world) {
    const levels = Array.from(world.query(dungeonLevelComponent));
    const activeFloors = new Set();
    const currentStep = world.step ?? 0;

    for (const [, level] of levels) {
      if (Array.isArray(level.floors) && level.floors.length > 0 && !level.floors.includes(level.activeFloorId)) {
        level.activeFloorId = level.floors[0];
      }
      if (level.activeFloorId != null) {
        activeFloors.add(level.activeFloorId);
      }
    }

    for (const floorId of Array.from(pausedFloors.keys())) {
      if (activeFloors.has(floorId)) {
        pausedFloors.delete(floorId);
      }
    }

    for (const [, level] of levels) {
      if (!Array.isArray(level.floors)) continue;
      for (const floorId of level.floors) {
        if (!activeFloors.has(floorId)) {
          pausedFloors.set(floorId, currentStep);
        }
      }
    }

    if (notify) {
      notify({ activeFloors, pausedFloors: new Map(pausedFloors), step: currentStep });
    }
  };
}

export const __doc__ = {
  purpose: "Tracks active dungeon floors and records pause metadata",
  stability: "beta",
  author: "CODEX",
  version: "2025.11.11",
  notes: [
    "Ensures DungeonLevel.activeFloorId always corresponds to a known floor id.",
    "Publishes active and paused floor sets via callbacks for other systems.",
    "Runs after traversal so active floors reflect latest actor movement.",
  ],
};
