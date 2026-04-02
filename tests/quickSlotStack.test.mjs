import { assertEquals } from "jsr:@std/assert";
import {
  canQuickChipIdentify,
  peekStackTop,
  popUntilActionableTop,
  getQuickChipPrimaryAction,
  getQuickChipPrimaryActionLabel,
  isQuickChipActionable,
} from "../src/display/ui/hud.js";
import { rarityStyle } from "../src/display/ui/overlayUtils.js";

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
    return isQuickChipActionable(it);
  };

  popUntilActionableTop(stack, actionable);
  assertEquals(stack.map((it) => it.id), [20]);
  assertEquals(peekStackTop(stack)?.id, 20);
});

Deno.test("quick-chip unidentified pickup remains usable", () => {
  const item = {
    id: 30,
    type: "scroll",
    identity: "scroll_light",
    hasScrollOfIdentify: true,
    details: { identified: false },
  };
  assertEquals(getQuickChipPrimaryAction(item), "use");
  assertEquals(getQuickChipPrimaryActionLabel(item), "Use");
  assertEquals(canQuickChipIdentify(item), true);
});

Deno.test("quick-chip primary action uses apply for scroll of identify", () => {
  const item = { id: 31, type: "scroll", identity: "scroll_identify", details: { identified: true } };
  assertEquals(getQuickChipPrimaryAction(item), "apply");
  assertEquals(getQuickChipPrimaryActionLabel(item), "Apply");
});

Deno.test("quick-chip primary action label uses Socket for gems", () => {
  const item = { id: 32, type: "gem", canApply: true };
  assertEquals(getQuickChipPrimaryAction(item), "apply");
  assertEquals(getQuickChipPrimaryActionLabel(item), "Socket");
});

Deno.test("quick-chip treats gems as actionable stack items", () => {
  assertEquals(isQuickChipActionable({ type: "gem", count: 1 }), true);
  assertEquals(isQuickChipActionable({ type: "gem", count: 0 }), false);
});

Deno.test("quick-chip can show Identify without precomputed scroll flag", () => {
  const item = {
    id: 33,
    type: "scroll",
    identity: "scroll_light",
    details: { identified: false },
  };
  assertEquals(canQuickChipIdentify(item), true);
});

Deno.test("quick-chip rarity style maps epic to purple", () => {
  assertEquals(rarityStyle("epic"), { color: "#c47bff", fontWeight: "bold" });
});
