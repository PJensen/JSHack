const DEITY_UI_WIRING_INSTALLED = Symbol.for("jshack:main:deityUiWiring:installed");

export function installDeityUiWiring(world, { log }) {
  if (!world || typeof log !== "function" || world[DEITY_UI_WIRING_INSTALLED]) return;
  world[DEITY_UI_WIRING_INSTALLED] = true;

  world.on("deity:miracle", ({ message }) => {
    if (message) log(message);
  });

  world.on("deity:wrath", ({ deityName, damage, cursed }) => {
    log(`${deityName}'s WRATH strikes you down! (-${damage} HP, barely alive!)`);
    if (cursed) log(`You feel ${deityName}'s curse upon you!`);
  });

  world.on("deity:demand", ({ deityName }) => {
    log(`${deityName} hungers for an offering!`);
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
    log(`${deityName} grows ${labels[to] || to}.`);
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
    log(lines[dominant?.dimension] || `${deityName} stirs.`);
  });
}
