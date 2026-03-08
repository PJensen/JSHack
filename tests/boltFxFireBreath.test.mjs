import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createBoltFxController } from "../src/display/fx/boltFxController.js";
import { isInputLocked } from "../src/display/input/inputLock.js";

function installTestWindow() {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const prevWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    value: {},
    configurable: true,
    writable: true,
  });
  return () => {
    if (hadWindow) {
      Object.defineProperty(globalThis, "window", {
        value: prevWindow,
        configurable: true,
        writable: true,
      });
    } else {
      delete globalThis.window;
    }
  };
}

Deno.test("boltFx fire breath is a blocking slow-travel VFX window", () => {
  const restoreWindow = installTestWindow();

  try {
    const world = new World({ seed: 7 });
    const controller = createBoltFxController({
      world,
      cam: {},
      fx: { pool: { spawn() {} } },
      getPosition: (id) => (id === 99 ? { x: 4, y: 1 } : null),
    });
    controller.installListeners();

    world.emit("monster:firebreath", {
      from: { x: 1, y: 1 },
      to: { x: 4, y: 1 },
      tiles: [
        { x: 2, y: 1 },
        { x: 3, y: 1 },
        { x: 4, y: 1 },
      ],
      hitIds: [99],
    });

    assertEquals(controller.isBlocking(), true);
    assertEquals(isInputLocked(), true);

    controller.tick(0.25);
    assertEquals(controller.isBlocking(), true);
    assertEquals(isInputLocked(), true);

    controller.tick(0.45);
    assertEquals(controller.isBlocking(), true);
    assertEquals(isInputLocked(), true);

    controller.tick(0.15);
    assertEquals(controller.isBlocking(), false);
    assertEquals(isInputLocked(), false);
  } finally {
    restoreWindow();
  }
});
