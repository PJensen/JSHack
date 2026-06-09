import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert";

import { registerBuiltinCommands } from "../src/main/debug/consoleCommands.js";
import {
  isSfxDebugEnabled,
  reportSfxDebugInvocation,
  setSfxDebugEnabled,
  setSfxDebugLogger,
} from "../src/display/audio/audioWiring.js";

Deno.test("sfx debug command toggles logging and appends formatted debug lines", async () => {
  const commands = new Map();
  const lines = [];
  const debugConsole = {
    registerCommand(name, helpText, handler) {
      commands.set(name, { helpText, handler });
    },
    log(text, type = "debug") {
      lines.push({ text, type });
    },
  };

  setSfxDebugEnabled(false);
  setSfxDebugLogger(null);

  try {
    registerBuiltinCommands(debugConsole, {
      world: {},
      messageLog: { log() {} },
    });

    const sfx = commands.get("sfx");
    assert(sfx, "expected sfx command to be registered");
    assertStringIncludes(sfx.helpText, "sfx debug <enable|disable>");

    assertEquals(
      await sfx.handler("debug"),
      "SFX debug is disabled.\nUsage: sfx debug <enable|disable>",
    );
    assertEquals(
      await sfx.handler("debug enable"),
      "SFX debug enabled. Triggered sounds will append to the debug console.",
    );
    assertEquals(isSfxDebugEnabled(), true);

    await Promise.resolve();
    reportSfxDebugInvocation({
      id: "torch:ignite",
      bus: "ambient",
      volume: 0.75,
      priority: 1,
      file: "torch_ignite.wav",
    });

    assertEquals(lines.length, 1);
    assertEquals(lines[0].type, "debug");
    assertStringIncludes(lines[0].text, "  [sfx] torch:ignite");
    assertStringIncludes(lines[0].text, "bus:ambient");
    assertStringIncludes(lines[0].text, "file:torch_ignite.wav");

    assertEquals(await sfx.handler("debug disable"), "SFX debug disabled.");
    assertEquals(isSfxDebugEnabled(), false);

    reportSfxDebugInvocation({
      id: "spell:fireball",
      bus: "spells",
      volume: 0.5,
      priority: 1,
      file: "spell_fireball.wav",
    });
    assertEquals(lines.length, 1);

    assertEquals(
      await sfx.handler("debug enable"),
      "SFX debug enabled. Triggered sounds will append to the debug console.",
    );
    assertEquals(isSfxDebugEnabled(), true);

    reportSfxDebugInvocation({
      id: "spell:fireball",
      bus: "spells",
      volume: 0.5,
      priority: 1,
      file: "spell_fireball.wav",
    });
    assertEquals(lines.length, 2);
    assertStringIncludes(lines[1].text, "  [sfx] spell:fireball");
  } finally {
    setSfxDebugEnabled(false);
    setSfxDebugLogger(null);
  }
});

Deno.test("lockpick debug command opens overlay with injected constructor args", () => {
  const commands = new Map();
  const debugConsole = {
    registerCommand(name, helpText, handler) {
      commands.set(name, { helpText, handler });
    },
    log() {},
  };
  const originalWindow = globalThis.window;
  const opened = [];
  const target = new EventTarget();
  target.addEventListener("ui:openLockPicking", (ev) => {
    opened.push(ev.detail);
  });
  globalThis.window = target;

  try {
    registerBuiltinCommands(debugConsole, {
      world: {},
      messageLog: { log() {} },
    });

    const lockpick = commands.get("lockpick");
    assert(lockpick, "expected lockpick command to be registered");
    assertStringIncludes(lockpick.helpText, "lockpick [pins] [difficulty]");

    assertEquals(
      lockpick.handler("7 hard"),
      "Opened lock picker (7 pins, hard).",
    );
    assertEquals(opened, [{ pinCount: 7, difficulty: "hard" }]);
  } finally {
    globalThis.window = originalWindow;
  }
});
