import "./helpers/installContentMonsters.mjs";
import { assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { installScrollWandWiring } from "../src/main/wiring/scrollWandWiring.js";
import { isInputLocked, setInputLock } from "../src/display/input/inputLock.js";

function installTestWindow() {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const prevWindow = globalThis.window;
  Object.defineProperty(globalThis, "window", {
    value: globalThis,
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

Deno.test("scroll genocide chooser locks game input until a species is chosen", () => {
  const restoreWindow = installTestWindow();
  setInputLock("scroll:genocide:monsterChooser", false);

  const world = new World({ seed: 11 });
  const requests = [];
  let openedRequestId = 0;

  const onOpen = (ev) => {
    openedRequestId = Number(ev?.detail?.requestId || 0) | 0;
  };
  addEventListener("ui:openMonsterChooser", onOpen);
  world.on("scroll:genocide:request", (event) => requests.push(event));

  try {
    installScrollWandWiring({
      world,
      targeting: {},
      playerEntity: () => null,
    });

    world.emit("scroll:genocide", { actor: 42 });

    assertEquals(openedRequestId > 0, true);
    assertEquals(isInputLocked(), true);

    window.dispatchEvent(new CustomEvent("ui:monsterChosen", {
      detail: { requestId: openedRequestId, monsterId: "goblin" },
    }));

    assertEquals(isInputLocked(), false);
    assertEquals(requests, [{ actor: 42, query: "goblin" }]);
  } finally {
    removeEventListener("ui:openMonsterChooser", onOpen);
    setInputLock("scroll:genocide:monsterChooser", false);
    restoreWindow();
  }
});

Deno.test("scroll genocide chooser releases game input on cancel", () => {
  const restoreWindow = installTestWindow();
  setInputLock("scroll:genocide:monsterChooser", false);

  const world = new World({ seed: 12 });
  let openedRequestId = 0;

  const onOpen = (ev) => {
    openedRequestId = Number(ev?.detail?.requestId || 0) | 0;
  };
  addEventListener("ui:openMonsterChooser", onOpen);

  try {
    installScrollWandWiring({
      world,
      targeting: {},
      playerEntity: () => null,
    });

    world.emit("scroll:genocide", { actor: 42 });

    assertEquals(openedRequestId > 0, true);
    assertEquals(isInputLocked(), true);

    window.dispatchEvent(new CustomEvent("ui:monsterChooserCanceled", {
      detail: { requestId: openedRequestId },
    }));

    assertEquals(isInputLocked(), false);
  } finally {
    removeEventListener("ui:openMonsterChooser", onOpen);
    setInputLock("scroll:genocide:monsterChooser", false);
    restoreWindow();
  }
});
