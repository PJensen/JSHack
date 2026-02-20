const DEITY_UI_WIRING_INSTALLED = Symbol.for("jshack:main:deityUiWiring:installed");

export function installDeityUiWiring(world, { log }) {
  if (!world || typeof log !== "function" || world[DEITY_UI_WIRING_INSTALLED]) return;
  world[DEITY_UI_WIRING_INSTALLED] = true;

  /** Helper to log deity messages with type */
  const logDeity = (text) => {
    if (typeof log === 'function') {
      // Support both old log(string) and new log({text, type}) signatures
      if (typeof text === 'string') {
        log({ text, type: 'deity' });
      } else {
        log(text);
      }
    }
  };

  world.on("deity:miracle", ({ message }) => {
    if (message) logDeity(message);
  });

  world.on("deity:wrath", ({ deityName, damage, cursed, severityScale }) => {
    const scale = Number(severityScale || 1);
    if (scale > 1.05) {
      logDeity(`${deityName}'s WRATH crashes down with amplified fury! (-${damage} HP)`);
    } else {
      logDeity(`${deityName}'s WRATH crashes down! (-${damage} HP)`);
    }
    if (cursed) logDeity(`You feel ${deityName}'s curse upon you!`);
  });

  world.on("deity:offense", ({ deityName, offense, victimName, corpseName }) => {
    if (offense === "pet_murder") {
      logDeity(`${deityName} is horrified that you slew ${victimName || "your companion"}.`);
      return;
    }
    if (offense === "pet_corpse_desecration") {
      logDeity(`${deityName} recoils as you defile ${corpseName || "your companion's remains"}.`);
      return;
    }
    logDeity(`${deityName} condemns your sacrilege.`);
  });

  world.on("deity:demand", ({ deityName }) => {
    logDeity(`${deityName} hungers for an offering!`);
  });

  world.on("deity:moodShift", ({ deityName, to }) => {
    const labels = {
      wrath: "wrathful",
      serenity: "serene",
      hunger: "hungry",
      amusement: "amused",
      sorrow: "sorrowful",
      chaos: "chaotic",
    };
    logDeity(`${deityName} grows ${labels[to] || to}.`);
  });

  world.on("deity:utterance", ({ deityName, dominant }) => {
    const lines = {
      wrath: `"More blood!" bellows ${deityName}.`,
      serenity: `"You serve well," whispers ${deityName}.`,
      hunger: `"Feed me, mortal," growls ${deityName}.`,
      amusement: `${deityName} laughs at your antics.`,
      sorrow: `${deityName} weeps silently.`,
      chaos: "The air crackles with divine unease.",
    };
    logDeity(lines[dominant?.dimension] || `${deityName} stirs.`);
  });
}
