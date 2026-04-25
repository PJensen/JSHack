import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { allUrls, resolve } from "../src/display/audio/sounds.js";

Deno.test("sounds registry exposes thrown potion impact sound", () => {
  const sound = resolve("item:impact:potion");
  assertExists(sound);
  assertEquals(sound.file, "impact_potion.wav");
  assertEquals(sound.bus, "items");
});

Deno.test("sounds registry exposes fountain ambient loop as mp3", () => {
  const sound = resolve("fountain");
  assertExists(sound);
  assertEquals(sound.file, "ambient_fountain.mp3");
  assertEquals(sound.bus, "ambient");
});

Deno.test("sounds registry adopts descriptive weather filenames", () => {
  const stairAscend = resolve("stair:ascend");
  const stairDescend = resolve("stair:descend");
  const thunder = resolve("thunder");
  const distantThunder = resolve("thunder:distant");
  const rain = resolve("rain:loop");
  const church = resolve("ambient:church");
  const churchBell = resolve("church:bell");
  const cookingFire = resolve("ambient:cooking_fire");
  const holySite = resolve("ambient:holy_site");
  const smithy = resolve("ambient:smithy");
  const torchFlames = resolve("ambient:torch_flames");
  const ringing = resolve("ears:ringing");
  const metalDrop = resolve("item:drop:weapon:metal");
  const meteorImpact = resolve("spell:impact:meteor");
  const town = resolve("ambient:town");
  const tavern = resolve("ambient:tavern");
  const snakeAlert = resolve("snake:alert");
  const spiderAlert = resolve("spider:alert");
  const caveBearAlert = resolve("cave_bear:alert");
  const ratAlert = resolve("rat:alert");
  const boneDrop = resolve("item:drop:bone");
  const shieldBlocked = resolve("shield:blocked");
  const caveBearAttack = resolve("cave_bear:attack");
  const ratAttack = resolve("rat:attack");
  assertExists(stairAscend);
  assertExists(stairDescend);
  assertExists(thunder);
  assertExists(distantThunder);
  assertExists(rain);
  assertExists(church);
  assertExists(churchBell);
  assertExists(cookingFire);
  assertExists(holySite);
  assertExists(smithy);
  assertExists(torchFlames);
  assertExists(ringing);
  assertExists(metalDrop);
  assertExists(meteorImpact);
  assertExists(town);
  assertExists(tavern);
  assertExists(snakeAlert);
  assertExists(spiderAlert);
  assertExists(caveBearAlert);
  assertExists(ratAlert);
  assertExists(boneDrop);
  assertExists(shieldBlocked);
  assertExists(caveBearAttack);
  assertExists(ratAttack);
  assertEquals(stairAscend.file, "transition_coating.mp3");
  assertEquals(stairDescend.file, "transition_coating.mp3");
  assertEquals(thunder.file, "weather_lightning_strike.mp3");
  assertEquals(distantThunder.file, "weather_lightning_strike_distant.mp3");
  assertEquals(rain.file, "weather_rain.mp3");
  assertEquals(church.file, "ambient_church_inside.mp3");
  assertEquals(churchBell.file, "ambient_church_bells.mp3");
  assertEquals(cookingFire.file, "ambient_cooking_fire.mp3");
  assertEquals(holySite.file, "ambient_holy_site.mp3");
  assertEquals(smithy.file, "ambient_smithy.mp3");
  assertEquals(torchFlames.file, "ambient_torch_flames.mp3");
  assert(ringing.files?.includes("ears_ringing.mp3"));
  assert(ringing.files?.includes("ears_ringing_2.mp3"));
  assertEquals(metalDrop.file, "drop_weapon_metal.mp3");
  assert(meteorImpact.files?.includes("spell_meteor_impact.mp3"));
  assert(meteorImpact.files?.includes("spell_meteor_impact_2.mp3"));
  assertEquals(town.file, "ambient_town.mp3");
  assertEquals(tavern.file, "ambient_tavern.mp3");
  assertEquals(snakeAlert.file, "snake_alerted.mp3");
  assertEquals(spiderAlert.file, "spider_alerted.mp3");
  assertEquals(caveBearAlert.file, "cave_bear_alerted.mp3");
  assertEquals(ratAlert.file, "rat_alerted_1.mp3");
  assertEquals(boneDrop.file, "bone_dropped.mp3");
  assert(shieldBlocked.files && shieldBlocked.files.length === 6);
});

Deno.test("sounds registry exposes spider spell variant pools", () => {
  const seenLunge = new Set();
  const seenWeb = new Set();

  for (let i = 0; i < 40; i++) {
    const lunge = resolve("spell:spider_lunge");
    const web = resolve("spell:web_spit");
    assertExists(lunge);
    assertExists(web);
    seenLunge.add(lunge.file);
    seenWeb.add(web.file);
    assertEquals(lunge.bus, "spells");
    assertEquals(web.bus, "spells");
  }

  assertEquals(seenLunge, new Set(["spider_attack_1.mp3", "spider_attack_2.mp3", "spider_attack_3.mp3"]));
  assertEquals(seenWeb, new Set(["spider_attack_web_1.mp3", "spider_attack_web_2.mp3"]));
});

Deno.test("sounds registry exposes shield block variant pools", () => {
  const seenShieldBlock = new Set();

  for (let i = 0; i < 40; i++) {
    const blocked = resolve("shield:blocked");
    assertExists(blocked);
    seenShieldBlock.add(blocked.file);
    assertEquals(blocked.bus, "combat");
  }

  assertEquals(seenShieldBlock, new Set(["melee_shield_hit_1.mp3", "melee_shield_hit_2.mp3", "melee_shield_hit_3.mp3", "melee_shield_hit_4.mp3", "melee_shield_hit_5.mp3", "melee_shield_hit_6.mp3"]));
});

Deno.test("sounds registry preloads every spider variant url", () => {
  const urls = allUrls();

  assert(urls.includes("./assets/audio/spider_attack_1.mp3"));
  assert(urls.includes("./assets/audio/spider_attack_2.mp3"));
  assert(urls.includes("./assets/audio/spider_attack_3.mp3"));
  assert(urls.includes("./assets/audio/spider_attack_web_1.mp3"));
  assert(urls.includes("./assets/audio/spider_attack_web_2.mp3"));
  assert(urls.includes("./assets/audio/snake_alerted.mp3"));
  assert(urls.includes("./assets/audio/spider_alerted.mp3"));
  assert(urls.includes("./assets/audio/cave_bear_alerted.mp3"));
  assert(urls.includes("./assets/audio/cave_bear_attack_1.mp3"));
  assert(urls.includes("./assets/audio/cave_bear_attack_2.mp3"));
  assert(urls.includes("./assets/audio/rat_alerted_1.mp3"));
  assert(urls.includes("./assets/audio/rat_attack_1.mp3"));
  assert(urls.includes("./assets/audio/melee_shield_hit_1.mp3"));
  assert(urls.includes("./assets/audio/melee_shield_hit_2.mp3"));
  assert(urls.includes("./assets/audio/melee_shield_hit_3.mp3"));
  assert(urls.includes("./assets/audio/bone_dropped.mp3"));
});

Deno.test("sounds registry wires every spell mp3 asset", () => {
  const urls = new Set(allUrls());
  const spellMp3s = Array.from(Deno.readDirSync("assets/audio"))
    .filter((entry) => entry.isFile && /^spell.*\.mp3$/i.test(entry.name))
    .map((entry) => `./assets/audio/${entry.name}`)
    .sort();

  assert(spellMp3s.length > 0, "expected spell mp3 assets");
  for (const url of spellMp3s) {
    assert(urls.has(url), `missing sound registry entry for ${url}`);
  }
});
