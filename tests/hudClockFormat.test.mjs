import { assertEquals } from "jsr:@std/assert";
import { formatClockLabel12Hour } from "../src/main/ui/hudFeeds.js";

Deno.test("HUD clock formats simulation time as 12-hour display time", () => {
  assertEquals(formatClockLabel12Hour(0), "12:00 AM");
  assertEquals(formatClockLabel12Hour(30), "1:00 AM");
  assertEquals(formatClockLabel12Hour(360), "12:00 PM");
  assertEquals(formatClockLabel12Hour(405), "1:30 PM");
  assertEquals(formatClockLabel12Hour(719), "11:58 PM");
  assertEquals(formatClockLabel12Hour(720), "12:00 AM");
});
