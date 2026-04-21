import { createRng } from "../../lib/ecs-js/rng.js";

const PHASE_OPENERS = Object.freeze({
  breakfast: Object.freeze([
    "Morning, {listenerTitle},",
    "Up early, {listenerTitle},",
    "At first light, {listenerTitle},",
    "Before the ovens cool, {listenerTitle},",
  ]),
  work: Object.freeze([
    "Listen, {listenerTitle},",
    "I'll tell you plain, {listenerTitle},",
    "Mark me, {listenerTitle},",
    "I was saying, {listenerTitle},",
  ]),
  pub: Object.freeze([
    "Another cup, {listenerTitle},",
    "Lean closer, {listenerTitle},",
    "Hear me out, {listenerTitle},",
    "By the tavern fire, {listenerTitle},",
  ]),
  home: Object.freeze([
    "One last thing, {listenerTitle},",
    "Before we bar the door, {listenerTitle},",
    "Quiet now, {listenerTitle},",
    "At the hearth, {listenerTitle},",
  ]),
  default: Object.freeze([
    "Listen, {listenerTitle},",
    "Tell me, {listenerTitle},",
    "Look here, {listenerTitle},",
    "Neighbor,",
  ]),
});

const PHASE_PLACES = Object.freeze({
  breakfast: Object.freeze(["the doorstep", "the cookfire", "the lane outside", "the morning square"]),
  work: Object.freeze(["the lane", "the square", "the workyard", "the edge of town"]),
  pub: Object.freeze(["the tavern", "the long table", "the bar", "the back room"]),
  home: Object.freeze(["the hearth", "the stoop", "the shuttered lane", "the quiet end of town"]),
  default: Object.freeze(["the lane", "the square", "the village", "town"]),
});

const WEATHER_PHRASES = Object.freeze({
  clear: Object.freeze({
    openings: Object.freeze(["clear sky", "dry light", "open blue", "honest weather"]),
    problems: Object.freeze(["dust in the air", "hard ground", "sun on the stones", "wind carrying every sound"]),
  }),
  rain: Object.freeze({
    openings: Object.freeze(["this rain", "the wet air", "the gray sky", "the drizzle"]),
    problems: Object.freeze(["mud in the lanes", "slick boards", "damp grain", "cold sleeves"]),
  }),
  heavy_rain: Object.freeze({
    openings: Object.freeze(["this pounding rain", "the black weather", "that hard downpour", "the flooded sky"]),
    problems: Object.freeze(["water under every door", "deep mud", "soaked stores", "slippery stone"]),
  }),
});

const SHORTAGE_LINES = Object.freeze({
  food: Object.freeze(["food stores", "grain bins", "pantries", "the bread count"]),
  materials: Object.freeze(["lumber stacks", "iron stores", "repair timber", "stone piles"]),
  medicine: Object.freeze(["herb racks", "medicine chests", "healing stock", "bandage rolls"]),
  threat: Object.freeze(["watchfulness", "the gate watch", "steady nerves", "ready hands"]),
});

const MOON_SIGNS = Object.freeze([
  "the moon looks thin tonight",
  "the night has a waiting look to it",
  "the dark keeps listening",
  "the hills sound closer after sunset",
]);

const MOUNTAIN_RUMORS = Object.freeze([
  "the mountain keeps a second voice after dark",
  "there is a draft in the old stone that smells like wet iron",
  "something below keeps shifting where no hammer lands",
  "the deep tunnels remember every careless footstep",
]);

const TOWN_RUMORS = Object.freeze([
  "half the town is counting someone else's burdens",
  "word travels faster than carts in this place",
  "every doorway has a story leaning in it",
  "folk hear more than they admit before supper",
]);

const ROLE_GOSSIP = Object.freeze({
  farmer: Object.freeze([
    "the barkeep's stew kept half the dungeon runners alive last month",
    "heard the herbalist found something strange growing by the east wall",
    "the mill's been grinding day and night — someone's working hard",
  ]),
  woodcutter: Object.freeze([
    "the mason's patching faster than the walls can crack",
    "the smith's been burning through coal like his life depends on it",
    "heard the miner came up with something dark last week",
  ]),
  miner: Object.freeze([
    "the smith's been shouting at his forge more than usual",
    "the mason says the town's settling in strange places",
    "the farmer's worrying about his north field",
  ]),
  smith: Object.freeze([
    "the miner brought something dark up from below",
    "the mason's patching faster than stones can fall",
    "heard the woodcutter found ironwood deeper than he should",
  ]),
  priest: Object.freeze([
    "the miner's seen things that shouldn't be in the deep dark",
    "the herbalist speaks of plants that remember blood",
    "folk are praying more these days — they feel it too",
  ]),
  barkeep: Object.freeze([
    "the smith's been working through the night again",
    "heard the farmer's north field is failing",
    "the herbalist's stock is running thin",
  ]),
  villager: Object.freeze([
    "the barkeep knows everything — he hears it all",
    "the priest says something's stirring below the stone",
    "the smith's hammer sounds angrier than before",
  ]),
  mason: Object.freeze([
    "the miner says the deep stone is waking up",
    "the smith's repairs are holding better now",
    "the herbalist brought strange roots to the priest",
  ]),
  herbalist: Object.freeze([
    "the priest asked about plants that bind spirits",
    "the alchemist's been very quiet lately",
    "the farmer mentioned odd growths in his back field",
  ]),
  alchemist: Object.freeze([
    "the herbalist found moonleaf growing where it shouldn't",
    "the priest's asked for items I've never heard of before",
    "something's stirring the potions in their bottles at night",
  ]),
  gem_vendor: Object.freeze([
    "heard the adventurer's carrying something that glows",
    "the book vendor says there's demand for strange knowledge",
    "the smith's being asked for work that shouldn't exist",
  ]),
  book_vendor: Object.freeze([
    "folks are buying books about binding and wards",
    "the priest's been looking at old journals",
    "someone's asking questions about the deep places",
  ]),
});

const ROLE_LEXICON = Object.freeze({
  farmer: Object.freeze({
    title: "farmer",
    goods: Object.freeze(["grain", "seed sacks", "turnips", "field baskets"]),
    worksites: Object.freeze(["the south field", "the rows by the mill", "the orchard fence", "the wet furrows"]),
    boasts: Object.freeze([
      "the rows are coming in straight",
      "the soil still answers a patient hand",
      "a clean field can save a hard season",
      "a good harvest starts with quiet mornings",
    ]),
    worries: Object.freeze([
      "the crows are learning bold habits",
      "too much rain will sour the sacks",
      "one bad week can thin every pot in town",
      "the ground is asking for more hands than we have",
    ]),
  }),
  woodcutter: Object.freeze({
    title: "woodcutter",
    goods: Object.freeze(["firewood", "lumber", "split pine", "dry bundles"]),
    worksites: Object.freeze(["the woodline", "the stump yard", "the stacked cordwood", "the saw pit"]),
    boasts: Object.freeze([
      "an honest axe can keep a village warm",
      "the timber is still good if you cut it right",
      "clean splits make better walls and kinder fires",
      "I can hear rotten wood before I touch it",
    ]),
    worries: Object.freeze([
      "the good trunks are farther uphill every week",
      "wet wood makes smoke and excuses",
      "half the town asks for beams before they ask for nails",
      "stormfall leaves a mess no hand likes sorting",
    ]),
  }),
  miner: Object.freeze({
    title: "miner",
    goods: Object.freeze(["ore sacks", "coal", "stone chips", "fresh-cut iron"]),
    worksites: Object.freeze(["the lower shaft", "the cut face", "the ore cart", "the tunnel mouth"]),
    boasts: Object.freeze([
      "the vein still runs true if you follow it patiently",
      "good ore rings before it breaks",
      "you can read a tunnel by the dust on your boots",
      "a steady pick finds more than brute force ever will",
    ]),
    worries: Object.freeze([
      "the supports groan louder than they should",
      "the deep rock is waking up again",
      "too many carts come up light",
      "there is bad air where there should be none",
    ]),
  }),
  smith: Object.freeze({
    title: "smith",
    goods: Object.freeze(["nails", "hinges", "tool heads", "new ironwork"]),
    worksites: Object.freeze(["the forge", "the quench trough", "the anvil block", "the smithy yard"]),
    boasts: Object.freeze([
      "a proper edge forgives no sloppy hand",
      "good iron makes quiet promises",
      "half the town stands because the hinges do",
      "heat and patience still beat panic",
    ]),
    worries: Object.freeze([
      "the forge eats coal faster than gossip spreads",
      "cheap metal tells on itself by noon",
      "too many repairs are turning urgent at once",
      "everyone remembers a smith when the latch fails",
    ]),
  }),
  priest: Object.freeze({
    title: "priest",
    goods: Object.freeze(["lamp oil", "blessed thread", "altar candles", "votive ash"]),
    worksites: Object.freeze(["the chapel", "the altar rail", "the candle bench", "the prayer steps"]),
    boasts: Object.freeze([
      "steady rituals keep fear from growing teeth",
      "a quiet chapel can steady a whole street",
      "small blessings do more work than loud boasting",
      "folk breathe easier when the bells answer",
    ]),
    worries: Object.freeze([
      "too many prayers are coming in whispered now",
      "the candles gutter strangely at dusk",
      "folk keep looking over their shoulder mid-prayer",
      "bad dreams are making the rounds again",
    ]),
  }),
  barkeep: Object.freeze({
    title: "barkeep",
    goods: Object.freeze(["ale", "stew pots", "clean mugs", "room keys"]),
    worksites: Object.freeze(["the bar", "the cask room", "the common table", "the kitchen door"]),
    boasts: Object.freeze([
      "a warm tavern can patch half a town's mood",
      "you learn more over stew than over shouting",
      "folk loosen truth before they loosen purse strings",
      "a full room is the closest thing to a town heartbeat",
    ]),
    worries: Object.freeze([
      "the casks are dipping too quickly this week",
      "nervous drinkers spill more than ale",
      "someone keeps bringing cave mud onto my clean floor",
      "quiet taverns make me suspicious",
    ]),
  }),
  villager: Object.freeze({
    title: "villager",
    goods: Object.freeze(["bundles", "laundry", "baskets", "market odds and ends"]),
    worksites: Object.freeze(["the main lane", "the village green", "the wash line", "the market square"]),
    boasts: Object.freeze([
      "someone has to keep the place stitched together",
      "towns run on the little errands nobody praises",
      "small jobs done early save bigger grief later",
      "you can feel a village sag when chores pile up",
    ]),
    worries: Object.freeze([
      "everyone looks more tired than yesterday",
      "doors are getting barred earlier this month",
      "the errands keep getting longer while the days do not",
      "folk keep speaking in half-sentences lately",
    ]),
  }),
  mason: Object.freeze({
    title: "mason",
    goods: Object.freeze(["stone blocks", "mortar", "cut slate", "patch stone"]),
    worksites: Object.freeze(["the wall foot", "the stone yard", "the scaffold", "the cracked arch"]),
    boasts: Object.freeze([
      "stone stays honest if you set it well",
      "a tight wall keeps fear outside where it belongs",
      "mortar is patience pretending to be mud",
      "I trust fitted stone more than quick promises",
    ]),
    worries: Object.freeze([
      "hairline cracks are starting to gossip to me",
      "rain finds every lazy joint",
      "too many patches are turning into rebuilds",
      "the old wall wants more stone than we can spare",
    ]),
  }),
  herbalist: Object.freeze({
    title: "herbalist",
    goods: Object.freeze(["herb bundles", "dry roots", "tinctures", "salve jars"]),
    worksites: Object.freeze(["the drying rack", "the herb bench", "the garden rows", "the mortar table"]),
    boasts: Object.freeze([
      "a careful leaf can do the work of a sword arm",
      "healing starts with noticing the small things",
      "the right root at the right hour still feels like a miracle",
      "half my craft is knowing when not to dose",
    ]),
    worries: Object.freeze([
      "the drying racks are thinning too fast",
      "spoiled roots waste more than time",
      "rain makes half the useful herbs sulk in the dirt",
      "nobody remembers their remedies until panic arrives",
    ]),
  }),
  alchemist: Object.freeze({
    title: "alchemist",
    goods: Object.freeze(["phials", "reagents", "stabilized salts", "sealed draughts"]),
    worksites: Object.freeze(["the bench", "the still", "the reagent shelf", "the mixing table"]),
    boasts: Object.freeze([
      "precision saves eyebrows and livelihoods alike",
      "good mixtures behave because I make them behave",
      "the difference between cure and crater is usually a drop",
      "a clean bench is the beginning of wisdom",
    ]),
    worries: Object.freeze([
      "humidity keeps trying to ruin my ratios",
      "half the town thinks a bottle is faster than caution",
      "someone is storing corks like they grow on trees",
      "volatile stock goes bad exactly when people get desperate",
    ]),
  }),
  gem_vendor: Object.freeze({
    title: "gem merchant",
    goods: Object.freeze(["cut stones", "rough gems", "polished quartz", "tiny velvet rolls"]),
    worksites: Object.freeze(["the display case", "the appraisal stool", "the velvet counter", "the bright front room"]),
    boasts: Object.freeze([
      "a steady eye can spot value through a fistful of mud",
      "stones speak plainly if the light is right",
      "people pay well for what glitters and endures",
      "a patient appraisal is better than an expensive mistake",
    ]),
    worries: Object.freeze([
      "wet weather dulls half my best stones",
      "nervous buyers bargain like they are being chased",
      "too many folk bring me cracked pretties and brave faces",
      "shaky hands and fine gems do not belong together",
    ]),
  }),
  book_vendor: Object.freeze({
    title: "bookseller",
    goods: Object.freeze(["scroll tubes", "copied pages", "spellbooks", "ink jars"]),
    worksites: Object.freeze(["the front shelf", "the reading desk", "the copying table", "the ladder aisle"]),
    boasts: Object.freeze([
      "well-kept pages outlive louder heroes",
      "ink is cheaper than ignorance and twice as sharp",
      "a town that reads stands up straighter",
      "cataloguing is a kind of mercy in troubled times",
    ]),
    worries: Object.freeze([
      "damp weather is murder on bindings",
      "borrowers keep becoming forgetful all at once",
      "everybody wants the dangerous volumes on rainy days",
      "too much panic makes folk skip the fine print",
    ]),
  }),
});

const TOPICS = Object.freeze([
  Object.freeze({
    key: "weather",
    baseWeight: 5,
    templates: Object.freeze([
      "{weatherOpening} is going to make a liar of {speakerWorksite}.",
      "{weatherOpening} has everyone thinking twice about {speakerGoods}.",
      "With {weatherProblem} everywhere, even {listenerWorksite} will start complaining.",
      "If {weatherOpening} holds, {speakerWorry}.",
    ]),
  }),
  Object.freeze({
    key: "work",
    baseWeight: 5,
    templates: Object.freeze([
      "{speakerBoast}, and I mean to prove it before dusk.",
      "All day at {speakerWorksite}, I kept thinking that {speakerBoast}.",
      "{speakerWorksite} is rough today, but {speakerBoast}.",
      "Give me a clean hour at {speakerWorksite} and I will settle more than rumors.",
    ]),
  }),
  Object.freeze({
    key: "shortage",
    baseWeight: 3,
    templates: Object.freeze([
      "I do not like the look of {townNeed}.",
      "Everyone smiles until they start counting {townNeed}.",
      "If {townNeed} keeps thinning, this place will feel it before long.",
      "I have seen leaner times, and {townNeed} is starting to sound familiar.",
    ]),
  }),
  Object.freeze({
    key: "trade",
    baseWeight: 4,
    templates: Object.freeze([
      "{speakerGoods} are moving quicker than {listenerGoods} today.",
      "Half the town wants {speakerGoods}, and the other half wants them cheaper.",
      "I would swap a cart of {speakerGoods} for one week without haggling.",
      "You can measure nerves by how people ask after {speakerGoods}.",
    ]),
  }),
  Object.freeze({
    key: "rumor",
    baseWeight: 3,
    templates: Object.freeze([
      "{townRumor}.",
      "I heard that {mountainRumor}.",
      "No one says it aloud, but {mountainRumor}.",
      "{townRumor}, and folk pretend not to notice.",
    ]),
  }),
  Object.freeze({
    key: "safety",
    baseWeight: 2,
    templates: Object.freeze([
      "The town feels steadier when {listenerTitle}s keep close watch.",
      "I would sleep easier if the gate watch looked less tired.",
      "Some days the whole place balances on {threatNeed}.",
      "We can weather most trouble if steady hands stay steady.",
    ]),
  }),
  Object.freeze({
    key: "tavern",
    baseWeight: 2,
    templates: Object.freeze([
      "{phasePlace} hears more truth than the square ever will.",
      "If you sit quiet in {phasePlace}, the whole town starts explaining itself.",
      "A table in {phasePlace} can mend a quarrel faster than a sermon.",
      "Folk loosen up around {phasePlace}, then pretend they never did.",
    ]),
  }),
  Object.freeze({
    key: "omens",
    baseWeight: 2,
    templates: Object.freeze([
      "{moonSign}.",
      "I do not love how {moonSign}.",
      "Strange weather is one thing; stranger silence is another.",
      "Some nights the bells feel heavier before they ring.",
    ]),
  }),
  Object.freeze({
    key: "craft",
    baseWeight: 3,
    templates: Object.freeze([
      "Your {listenerGoods} and my {speakerGoods} could fix half the village by week's end.",
      "There is no trouble in town that cannot be reduced to missing hands and the wrong supplies.",
      "Most hard days become manageable once the right tools reach the right bench.",
      "People call it luck when craft solves what panic could not.",
    ]),
  }),
  Object.freeze({
    key: "grievance",
    baseWeight: 3,
    templates: Object.freeze([
      "{speakerWorry}.",
      "I can handle hard work; I resent sloppy work.",
      "Too many people want miracles delivered faster than honest labor allows.",
      "Everybody wants certainty, but most of them bring me guesses.",
    ]),
  }),
  Object.freeze({
    key: "gossip",
    baseWeight: 4,
    templates: Object.freeze([
      "{gossipItem}.",
      "Heard word that {gossipItem}.",
      "Between us, {gossipItem}.",
      "Folk are saying {gossipItem}.",
    ]),
  }),
]);

function pick(rng, list, fallback = "") {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  return list[rng.int(0, list.length - 1)] ?? fallback;
}

function weightedPick(rng, list, weightFn) {
  let total = 0;
  for (const entry of list) total += Math.max(0, Number(weightFn(entry) || 0));
  if (total <= 0) return list[0] || null;
  let roll = rng.float() * total;
  for (const entry of list) {
    roll -= Math.max(0, Number(weightFn(entry) || 0));
    if (roll <= 0) return entry;
  }
  return list[list.length - 1] || null;
}

function lowerTitle(name, fallbackRole) {
  const raw = String(name || "").trim();
  if (raw) return raw.toLowerCase();
  const lex = ROLE_LEXICON[fallbackRole];
  return String(lex?.title || "neighbor");
}

function lexiconFor(role) {
  return ROLE_LEXICON[role] || ROLE_LEXICON.villager;
}

function shortagePool(townState) {
  const pools = [];
  if (townState?.lowFood) pools.push(...SHORTAGE_LINES.food);
  if (townState?.lowMaterials) pools.push(...SHORTAGE_LINES.materials);
  if (townState?.lowMedicine) pools.push(...SHORTAGE_LINES.medicine);
  if (Number(townState?.threatLevel || 0) > 0) pools.push(...SHORTAGE_LINES.threat);
  if (pools.length > 0) return pools;
  return [
    ...SHORTAGE_LINES.food,
    ...SHORTAGE_LINES.materials,
    ...SHORTAGE_LINES.medicine,
  ];
}

function topicWeight(topic, ctx) {
  let weight = Number(topic.baseWeight || 0);
  if (weight <= 0) return 0;
  if (topic.key === "weather" && ctx.weather !== "clear") weight += 4;
  if (topic.key === "shortage") {
    if (ctx.townState?.lowFood) weight += 4;
    if (ctx.townState?.lowMaterials) weight += 3;
    if (ctx.townState?.lowMedicine) weight += 3;
  }
  if (topic.key === "safety" && Number(ctx.townState?.threatLevel || 0) > 0) weight += 5;
  if (topic.key === "tavern" && ctx.phase === "pub") weight += 6;
  if (topic.key === "omens" && (ctx.phase === "home" || ctx.phase === "pub")) weight += 3;
  if (topic.key === "craft" && (ctx.speakerRole === "smith" || ctx.speakerRole === "mason" || ctx.speakerRole === "alchemist" || ctx.listenerRole === "smith")) weight += 3;
  if (topic.key === "trade" && (ctx.speakerRole === "barkeep" || ctx.speakerRole === "gem_vendor" || ctx.speakerRole === "book_vendor" || ctx.speakerRole === "alchemist")) weight += 3;
  if (topic.key === "work" && ctx.phase === "work") weight += 4;
  if (topic.key === "grievance" && ctx.weather === "heavy_rain") weight += 2;
  if (topic.key === "gossip" && ctx.phase === "pub") weight += 3;
  if (ctx.previousTopic && ctx.previousTopic === topic.key) weight *= 0.35;
  return weight;
}

function render(template, vars) {
  return String(template || "").replace(/\{([a-zA-Z0-9_]+)\}/g, (_match, key) => {
    const value = vars[key];
    return value == null ? "" : String(value);
  }).replace(/\s+/g, " ").trim();
}

function buildVars(ctx, rng) {
  const speaker = lexiconFor(ctx.speakerRole);
  const listener = lexiconFor(ctx.listenerRole);
  const weather = WEATHER_PHRASES[ctx.weather] || WEATHER_PHRASES.clear;
  const phasePlaces = PHASE_PLACES[ctx.phase] || PHASE_PLACES.default;
  const shortages = shortagePool(ctx.townState);
  const speakerGossip = ROLE_GOSSIP[ctx.speakerRole] || ROLE_GOSSIP.villager;

  return {
    listenerTitle: lowerTitle(ctx.listenerName, ctx.listenerRole),
    speakerTitle: lowerTitle(ctx.speakerName, ctx.speakerRole),
    speakerGoods: pick(rng, speaker.goods, "supplies"),
    listenerGoods: pick(rng, listener.goods, "supplies"),
    speakerWorksite: pick(rng, speaker.worksites, "the lane"),
    listenerWorksite: pick(rng, listener.worksites, "the lane"),
    speakerBoast: pick(rng, speaker.boasts, "steady work still matters"),
    speakerWorry: pick(rng, speaker.worries, "something is not sitting right"),
    weatherOpening: pick(rng, weather.openings, "the weather"),
    weatherProblem: pick(rng, weather.problems, "trouble"),
    phasePlace: pick(rng, phasePlaces, "town"),
    townNeed: pick(rng, shortages, "stores"),
    threatNeed: pick(rng, SHORTAGE_LINES.threat, "steady hands"),
    mountainRumor: pick(rng, MOUNTAIN_RUMORS, "the mountain is holding its breath"),
    townRumor: pick(rng, TOWN_RUMORS, "folk are saying too much and too little at once"),
    moonSign: pick(rng, MOON_SIGNS, "the night feels restless"),
    gossipItem: pick(rng, speakerGossip, "something strange is happening in town"),
  };
}

function topicSeed(seed, speakerId, listenerId, step) {
  const a = Math.imul((Number(speakerId || 0) | 0) >>> 0, 0x9e3779b1) >>> 0;
  const b = Math.imul((Number(listenerId || 0) | 0) >>> 0, 0x85ebca6b) >>> 0;
  const c = Math.imul((Number(step || 0) | 0) >>> 0, 0x27d4eb2d) >>> 0;
  return ((seed >>> 0) ^ a ^ b ^ c ^ 0x54414c4b) >>> 0;
}

export function generateTownfolkAmbientLine({
  seed = 0,
  speakerId = 0,
  listenerId = 0,
  speakerName = "",
  listenerName = "",
  speakerRole = "villager",
  listenerRole = "villager",
  phase = "work",
  weather = "clear",
  townState = null,
  step = 0,
  previousTopic = "",
}) {
  const rng = createRng(topicSeed(seed, speakerId, listenerId, step));
  const ctx = {
    speakerName,
    listenerName,
    speakerRole,
    listenerRole,
    phase,
    weather,
    townState,
    previousTopic,
  };
  const topic = weightedPick(rng, TOPICS, (entry) => topicWeight(entry, ctx)) || TOPICS[0];
  const vars = buildVars(ctx, rng);
  const openers = PHASE_OPENERS[phase] || PHASE_OPENERS.default;
  const opener = render(pick(rng, openers, "Listen,"), vars);
  const body = render(pick(rng, topic.templates, "The day has its own mind."), vars);
  const maybeTail = rng.float() < 0.42
    ? ` ${render(pick(rng, [
      "{speakerBoast}.",
      "{speakerWorry}.",
      "{townRumor}.",
      "{moonSign}.",
    ], ""), vars)}`
    : "";
  const text = `${opener} ${body}${maybeTail}`.replace(/\s+/g, " ").trim();
  return {
    topic: topic.key,
    text,
  };
}
