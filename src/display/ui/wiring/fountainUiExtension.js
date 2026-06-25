import { defineExtension } from "../../../lib/ecs-js/index.js";
import { FountainDipPrompted } from "../../../events/FountainDipPrompted.js";
import { InteractionChoicePrompted } from "../../../events/InteractionChoicePrompted.js";

const FOUNTAIN_UI_KEY = Symbol.for("jshack:display:fountainUi");

export function createFountainUiExtension({ getPlayerEntity, getItemInfo, resolveItemDisplayName }) {
  return defineExtension("jshack:display:fountainUi", (world) => {
    const offDip = world.on(FountainDipPrompted, ({ actor, targetId, items }) => {
      const player = getPlayerEntity();
      if (!player || player.id !== actor) return;
      const dippableItems = items.flatMap((id) => {
        const info = getItemInfo(Number(id || 0));
        if (!info) return [];
        return [{
          id,
          type: info.type || "item",
          name: resolveItemDisplayName(Number(id || 0)),
          count: info.count || 1,
          rarityName: info.rarityName || "common",
          value: info.value || 0,
        }];
      });
      globalThis.dispatchEvent(new CustomEvent("ui:fountainDipPrompt", {
        detail: { fountainId: targetId, items: dippableItems },
      }));
    });
    const offChoice = world.on(InteractionChoicePrompted, ({ actor, targetId, action, options }) => {
      const player = getPlayerEntity();
      if (!player || player.id !== actor) return;
      globalThis.dispatchEvent(new CustomEvent("ui:actionChooser", {
        detail: { targetId, action, options },
      }));
    });
    return () => { offDip(); offChoice(); };
  }, { key: FOUNTAIN_UI_KEY });
}
