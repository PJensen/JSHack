import { assertEquals } from "jsr:@std/assert";
import { join } from "jsr:@std/path";

/**
 * @param {string} dir
 * @returns {Promise<string[]>}
 */
async function listJsFiles(dir) {
  const out = [];
  for await (const entry of Deno.readDir(dir)) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory) {
      out.push(...await listJsFiles(fullPath));
      continue;
    }
    if (!entry.isFile) continue;
    if (!fullPath.endsWith(".js")) continue;
    out.push(fullPath);
  }
  return out;
}

const WORLD_STATE_ATTACHMENT_ALLOWANCES = Object.freeze({
  "src/rules/content/enchanting/benchGame.js": 2,
  "src/rules/content/useActions/fishingAction.js": 5,
  "src/rules/data/callbacks/ai.js": 5,
  "src/rules/data/callbacks/combat.js": 9,
  "src/rules/data/combatInteractions.js": 2,
  "src/rules/data/gemSocketAffixes.js": 2,
  "src/rules/data/lootResolver.js": 2,
  "src/rules/dialogues/runtime.js": 7,
  "src/rules/quests/definitions/graveyardWatch.js": 2,
  "src/rules/quests/definitions/ratInfestation.js": 2,
  "src/rules/quests/definitions/runContract.js": 2,
  "src/rules/quests/runtime.js": 5,
  "src/rules/systems/affixTriggerSystem.js": 2,
  "src/rules/systems/aiChaseSystem.js": 2,
  "src/rules/systems/aiTownfolkSystem.js": 9,
  "src/rules/systems/cleanupSystem.js": 4,
  "src/rules/systems/combatSystem.js": 2,
  "src/rules/systems/curseHooks.js": 2,
  "src/rules/systems/deitySystem.js": 12,
  "src/rules/systems/engraveSystem.js": 2,
  "src/rules/systems/fountainRegrowthSystem.js": 5,
  "src/rules/systems/genocideSystem.js": 2,
  "src/rules/systems/harvestRegrowthSystem.js": 5,
  "src/rules/systems/interactionSystem.js": 2,
  "src/rules/systems/materialReactionSystem.js": 9,
  "src/rules/systems/monsterDeathHookSystem.js": 2,
  "src/rules/systems/movementSystem.js": 5,
  "src/rules/systems/petBehaviorSystem.js": 3,
  "src/rules/systems/plantGrowthSystem.js": 8,
  "src/rules/systems/polymorphSystem.js": 2,
  "src/rules/systems/praySystem.js": 2,
  "src/rules/systems/shopAmbientSoundSystem.js": 2,
  "src/rules/systems/tamingSystem.js": 2,
  "src/rules/systems/tauntSystem.js": 2,
  "src/rules/systems/threatSystem.js": 2,
  "src/rules/systems/tileStepEffectSystem.js": 2,
  "src/rules/systems/tombstoneSystem.js": 3,
  "src/rules/systems/townfolkAmbientDialogueSystem.js": 2,
  "src/rules/systems/trapSystem.js": 6,
  "src/rules/utils/aiCooldowns.js": 2,
  "src/rules/utils/centipedeMovement.js": 2,
  "src/rules/utils/derivedStats.js": 5,
  "src/rules/utils/disposition.js": 2,
  "src/rules/utils/inventoryVirtuals.js": 6,
  "src/rules/utils/itemCooldowns.js": 5,
  "src/rules/utils/passiveBonuses.js": 3,
  "src/rules/utils/reputation.js": 2,
  "src/rules/utils/shopDebt.js": 3,
  "src/rules/utils/shopLaw.js": 2,
  "src/rules/utils/spellCooldowns.js": 6,
  "src/rules/utils/townInterpretationVirtuals.js": 6,
});

function stripLineComments(raw) {
  return raw.split("\n").map((line) => {
    const ci = line.indexOf("//");
    return ci >= 0 ? line.slice(0, ci) : line;
  }).join("\n");
}

function countWorldStateAttachments(text) {
  return [...text.matchAll(/\b(?:ctx\.)?world\s*\[/g)].length;
}

Deno.test("rules world-attached state stays ratcheted", async () => {
  const root = Deno.cwd();
  const files = await listJsFiles(join(root, "src/rules"));
  const offenders = [];

  for (let i = 0; i < files.length; i++) {
    const absPath = files[i];
    const relPath = absPath.slice(root.length + 1);
    const text = stripLineComments(await Deno.readTextFile(absPath));
    const count = countWorldStateAttachments(text);
    if (count <= 0) continue;

    const allowance = WORLD_STATE_ATTACHMENT_ALLOWANCES[relPath] || 0;
    if (count > allowance) {
      offenders.push(`${relPath} has ${count}; allowance is ${allowance}`);
    }
  }

  assertEquals(
    offenders,
    [],
    "Do not attach new state to world via world[...] or ctx.world[...]. " +
      "Use ECS component state, including singleton entities when world-scope state is required. " +
      `Offenders: ${offenders.join(", ")}`,
  );
});
