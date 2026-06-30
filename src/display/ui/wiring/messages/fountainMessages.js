import { defineExtension } from "../../../../lib/ecs-js/index.js";
import { FountainDrinkResolved } from "../../../../events/FountainDrinkResolved.js";
import { FountainDipResolved } from "../../../../events/FountainDipResolved.js";
import { FountainDried } from "../../../../events/FountainDried.js";
import { FountainPurified } from "../../../../events/FountainPurified.js";

const FOUNTAIN_MESSAGES_KEY = Symbol.for("jshack:display:fountainMessages");

export function createFountainMessagesExtension({ log, nameOfEntity }) {
  return defineExtension("jshack:display:fountainMessages", (world) => {
    const offDrink = world.on(FountainDrinkResolved, (event) => {
      if (nameOfEntity(event.actor) !== "You") return;
      const { effect, amount } = event;
      if (effect === "heal") log(`You take a sip and feel vigour course through you. (+${amount} HP)`, "system");
      else if (effect === "mana") log(`The water tastes faintly of ozone. Magical energy surges into you. (+${amount} MP)`, "system");
      else if (effect === "buff") log(`A warm tingle spreads through you. (${event.buff})`, "system");
      else if (effect === "see_invisible") log("Your eyes sting. The air shimmers. You can see things that aren’t entirely there.", "system");
      else if (effect === "gold") log(`Gold coins bubble up from the depths! (+${amount} gold)`, "system");
      else if (effect === "curse") log(event.cursedName ? `A black aura crawls over your ${event.cursedName}!` : "The water is ice-cold.", event.cursedName ? "danger" : "system");
      else if (effect === "poison") log(`Gah — the water is foul! (-${amount} HP)`, "combat");
      else if (effect === "creature") log(event.spawnedName ? `A ${event.spawnedName} surges out of the fountain!` : "The water churns ominously, then stills.", event.spawnedName ? "danger" : "system");
      else if (effect === "teleport") log("The water tastes like static. The world lurches!", "danger");
      else if (effect === "gush") log("The fountain erupts! Water gushes everywhere!", "danger");
      else if (effect === "wish") log(event.wishedItem ? `A spirit grants you ${event.wishedItem}!` : "A spirit stirs, then sinks away.", "system");
      else if (effect === "blessing") log("The fountain's consecrated water settles a blessing over you.", "system");
      else log("You take a sip. The water tastes faintly of copper.", "system");
    });
    const offDip = world.on(FountainDipResolved, (event) => {
      if (nameOfEntity(event.actor) !== "You") return;
      const name = event.itemName;
      const messages = {
        uncurse: [`The dark aura around ${name} lifts.`, "system"],
        bless: [`A warm light envelops ${name}.`, "system"],
        curse: [`A malign energy clings to ${name}.`, "danger"],
        rust: [`Reddish flakes cloud the water around ${name}.`, "danger"],
        blessedResist: [`${name} repels the water, but its blessing fades.`, "system"],
        resist: [`The water beads off ${name} harmlessly.`, "system"],
        waterlogged: [`${name} comes out waterlogged.`, "warning"],
        soggy: [`${name} turns soggy.`, "warning"],
        swollen: [`${name} swells from absorbed water.`, "warning"],
        diluted: [`${name}'s contents look thinned and cloudy.`, "warning"],
        mud: [`${name} slumps into wet mud.`, "warning"],
        wet: [`${name} comes out dripping wet.`, "system"],
      };
      if (event.effect === "creature") log(event.spawnedName ? "Something rises from the depths!" : "Bubbles surge up, then subside.", event.spawnedName ? "danger" : "system");
      else {
        const entry = messages[event.effect] || [`The water ripples around ${name}, but nothing happens.`, "system"];
        log(`You dip ${name} into the fountain. ${entry[0]}`, entry[1]);
      }
    });
    const offDry = world.on(FountainDried, ({ actor }) => {
      if (nameOfEntity(actor) === "You") log("You bend over the fountain. Dry as bone.", "system");
    });
    const offPurified = world.on(FountainPurified, ({ actor, itemName }) => {
      if (nameOfEntity(actor) === "You") log(`You pour ${itemName} into the basin. The fountain answers with warm light.`, "system");
    });
    return () => { offDrink(); offDip(); offDry(); offPurified(); };
  }, { key: FOUNTAIN_MESSAGES_KEY });
}
