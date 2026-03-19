import { assertEquals } from "jsr:@std/assert";
import { peekStackTop, popUntilActionableTop } from "../src/display/ui/hud.js";

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
