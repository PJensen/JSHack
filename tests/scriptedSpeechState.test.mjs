import { assertEquals } from "jsr:@std/assert";
import {
  activateScriptedSpeechBubble,
  advanceScriptedSpeechBubble,
  createScriptedSpeechBubble,
} from "../src/main/ui/scriptedSpeechState.js";

Deno.test("scripted speech turn pacing waits for turns instead of wall clock", () => {
  let shown = 0;
  let bubble = activateScriptedSpeechBubble(createScriptedSpeechBubble({
    entityId: 7,
    text: "Hello",
    delayTurns: 1,
    holdTurns: 2,
    onShow: () => { shown++; },
  }), 10);

  let result = advanceScriptedSpeechBubble(bubble, 10, 9.5);
  bubble = result.bubble;
  assertEquals(result.didShow, false);
  assertEquals(result.isExpired, false);
  assertEquals(shown, 0);

  result = advanceScriptedSpeechBubble(bubble, 11, 0.1);
  bubble = result.bubble;
  assertEquals(result.didShow, true);
  assertEquals(result.isExpired, false);
  assertEquals(bubble.delayTurns, 0);
  assertEquals(bubble.holdTurns, 2);
  result.onShow?.();
  assertEquals(shown, 1);

  result = advanceScriptedSpeechBubble(bubble, 12, 0.1);
  bubble = result.bubble;
  assertEquals(result.isExpired, false);
  assertEquals(bubble.holdTurns, 1);

  result = advanceScriptedSpeechBubble(bubble, 13, 0.1);
  assertEquals(result.isExpired, true);
});

Deno.test("queued turn-paced speech does not burn turns before activation", () => {
  const queued = createScriptedSpeechBubble({
    entityId: 9,
    text: "Second line",
    holdTurns: 1,
  });

  const activated = activateScriptedSpeechBubble(queued, 25);
  const result = advanceScriptedSpeechBubble(activated, 25, 4.0);
  assertEquals(result.isExpired, false);
  assertEquals(result.bubble.holdTurns, 1);
});
