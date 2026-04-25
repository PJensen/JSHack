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

Deno.test("oracular message formatter leaves prose unbracketized", () => {
  const html = formatOracularMessageHtml(
    "Rat corpse: disease. Snake corpse: poison. Floating eye corpse: you forget who you are.",
  );

  assertEquals(
    html,
    "Rat corpse: disease. Snake corpse: poison. Floating eye corpse: you forget who you are.",
  );
  assert(!html.includes("[Rat]"));
  assert(!html.includes("oracle-term"));
});

Deno.test("oracular message formatter escapes html", () => {
  const html = formatOracularMessageHtml("<img src=x onerror=alert(1)> Rat");

  assert(html.includes("&lt;img src=x onerror=alert(1)&gt;"));
  assert(html.endsWith(" Rat"));
});
