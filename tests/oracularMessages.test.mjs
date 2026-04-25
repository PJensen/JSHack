import { assert, assertEquals } from "jsr:@std/assert";
import {
  formatOracularMessageHtml,
  HINTS,
  ORACULAR_MESSAGES,
} from "../src/shared/data/hints.js";

Deno.test("boot and character creation use the same canonical oracular messages", () => {
  assertEquals(ORACULAR_MESSAGES, HINTS);
  assert(ORACULAR_MESSAGES.length > 20, "expected a substantial canonical message set");
});

Deno.test("oracular message formatter bracketizes and bolds known game terms", () => {
  const html = formatOracularMessageHtml(
    "Rat corpse: disease. Snake corpse: poison. Floating eye corpse: you forget who you are.",
  );

  assert(html.includes('<b class="oracle-term">[Rat]</b>'));
  assert(html.includes('<b class="oracle-term">[disease]</b>'));
  assert(html.includes('<b class="oracle-term">[Snake]</b>'));
  assert(html.includes('<b class="oracle-term">[poison]</b>'));
  assert(html.includes('<b class="oracle-term">[Floating eye]</b>'));
  assert(formatOracularMessageHtml("Items can be thrown.").includes('<b class="oracle-term">[Items]</b>'));
});

Deno.test("oracular message formatter escapes html before applying trusted term markup", () => {
  const html = formatOracularMessageHtml("<img src=x onerror=alert(1)> Rat");

  assert(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert(html.includes('<b class="oracle-term">[Rat]</b>'));
});
