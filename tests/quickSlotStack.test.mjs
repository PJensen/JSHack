import { assertEquals } from "jsr:@std/assert";
import {
  peekStackTop,
  popUntilActionableTop,
  getQuickChipPrimaryAction,
  getQuickChipPrimaryActionLabel,
  buildQuickChipStatsText,
} from "../src/display/ui/hud.js";

Deno.test("quick-slot stack peeks newest pickup first", () => {
  const stack = [];
  stack.push({ id: 10, type: "potion", name: "Health Potion" });
  stack.push({ id: 11, type: "scroll", name: "Scroll of Light" });

  assertEquals(peekStackTop(stack)?.id, 11);
  stack.pop();
  assertEquals(peekStackTop(stack)?.id, 10);
});

Deno.test("quick-slot stack pops non-actionable top before peek", () => {
  const stack = [
    { id: 20, type: "potion", name: "Health Potion", count: 1 },
    { id: 21, type: "quest", name: "Quest Relic", count: 1 },
  ];

  const actionable = (it) => {
    const t = String(it?.type || "");
    if (t === "equip" || t === "ammo" || t === "wand") return true;
    if (t === "tool") return true;
    if (t === "potion" || t === "scroll" || t === "learn" || t === "book" || t === "food") return (it?.count || 0) > 0;
    return false;
  };

  popUntilActionableTop(stack, actionable);
  assertEquals(stack.map((it) => it.id), [20]);
  assertEquals(peekStackTop(stack)?.id, 20);
});

Deno.test("quick-chip primary action identifies unidentified pickup when player has identify scroll", () => {
  const item = {
    id: 30,
    type: "scroll",
    identity: "scroll_light",
    hasScrollOfIdentify: true,
    details: { identified: false },
  };
  assertEquals(getQuickChipPrimaryAction(item), "identify");
  assertEquals(getQuickChipPrimaryActionLabel(item), "Identify");
});

Deno.test("quick-chip primary action uses apply for scroll of identify", () => {
  const item = { id: 31, type: "scroll", identity: "scroll_identify", details: { identified: true } };
  assertEquals(getQuickChipPrimaryAction(item), "apply");
  assertEquals(getQuickChipPrimaryActionLabel(item), "Apply");
});

Deno.test("quick-chip stats keep full item info but strip bag and rarity metadata", () => {
  const text = buildQuickChipStatsText({
    details: {
      bonuses: { attackBonus: 2, defense: 1 },
      detailLines: [
        "bag · rarity: epic · On hit: Ignite 25%",
        "magic · Socketed: +1 mana regeneration.",
      ],
      description: "bag · epic · A blade that sings.",
    },
  });

  assertEquals(
    text,
    "ATK +2 · DEF +1 · On hit: Ignite 25% · Socketed: +1 mana regeneration. · A blade that sings.",
  );
});
