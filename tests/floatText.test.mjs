import { assertEquals } from "jsr:@std/assert";
import { FloatText } from "../src/display/passes/vfx/text/floatText.js";

Deno.test("floatText addStatus respects caller overrides", () => {
  const ftext = new FloatText();
  const rec = ftext.addStatus(4, 5, "GAZE 4/5", {
    color: "#ff5fd2",
    life: 1.25,
    scaleStart: 1.4,
    scaleEnd: 0.9,
  });

  assertEquals(rec.color, "#ff5fd2");
  assertEquals(rec.life, 1.25);
  assertEquals(rec.scaleStart, 1.4);
  assertEquals(rec.scaleEnd, 0.9);
});
