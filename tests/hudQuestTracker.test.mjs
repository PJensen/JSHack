import { assert, assertEquals } from "jsr:@std/assert";
import { World } from "../src/lib/ecs-js/index.js";
import { createHudFeeds } from "../src/main/ui/hudFeeds.js";
import { Player } from "../src/rules/components/Player.js";
import { Position } from "../src/rules/components/Position.js";
import { installQuestRuntime, instantiateQuest, STARTER_PRIEST_FETCH_QUEST_ID } from "../src/rules/quests/runtime.js";
import { RAT_INFESTATION_QUEST_ID } from "../src/rules/quests/definitions/ratInfestation.js";
import { QuestVars } from "../src/rules/components/QuestVars.js";
import "../src/rules/quests/definitions/ratInfestation.js";
import "../src/rules/quests/definitions/graveyardWatch.js";

function installTestWindow() {
  const hadWindow = Object.prototype.hasOwnProperty.call(globalThis, "window");
  const prevWindow = globalThis.window;
  const target = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    value: target,
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

Deno.test("hud quest tracker publishes only accepted focused quests", () => {
  const restoreWindow = installTestWindow();

  try {
    const world = new World({ seed: 21 });
    installQuestRuntime(world);

    const player = world.create();
    world.add(player, Player, {});
    world.add(player, Position, { x: 3, y: 4 });

    const ratQuest = instantiateQuest(world, RAT_INFESTATION_QUEST_ID, {
      player,
      giver: 11,
      target: 11,
    }, {}, { node: "hunt" });
    world.set(ratQuest, QuestVars, { data: { accepted: true, killCount: 3, reported: false } });

    const unacceptedQuest = instantiateQuest(world, STARTER_PRIEST_FETCH_QUEST_ID, {
      player,
      giver: 12,
      target: 12,
    }, {}, { node: "recover" });
    world.set(unacceptedQuest, QuestVars, { data: { accepted: false, recovered: false, delivered: false } });

    const hudFeeds = createHudFeeds(world, {
      getPlayerMana: () => ({ mana: 10, maxMana: 10 }),
      ensureActiveSpell: () => null,
      updateActiveSpellLabel: () => {},
      knownSpellIds: () => [],
      getActionBarSlots: () => [],
      getPinnedSpellSlots: () => [],
      autoAssignSlot: () => -1,
      autoAssignPinnedSlot: () => -1,
    });

    const payloads = [];
    const onUpdate = (ev) => payloads.push(ev?.detail || null);
    window.addEventListener("ui:updateQuestTracker", onUpdate);
    hudFeeds.updateQuestTrackerHUD();
    window.removeEventListener("ui:updateQuestTracker", onUpdate);

    assert(payloads.length > 0, "expected quest tracker payload");
    const detail = payloads.at(-1);
    assert(detail?.focused, "expected a focused quest");
    assertEquals(detail.focused.questId, RAT_INFESTATION_QUEST_ID);
    assertEquals(detail.focused.progress, 3);
    assertEquals(detail.focused.target, 5);
    assertEquals(detail.focused.icon, "🐀");
    assertEquals(detail.focused.summary, "Clear the tavern cellar");
    assertEquals("moreCount" in detail, false);
  } finally {
    restoreWindow();
  }
});
