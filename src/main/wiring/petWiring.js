// src/main/wiring/petWiring.js
// Pet and summoned-creature command wiring.
// Single canonical applyCommand() replaces the duplicated switch/case blocks.

import { Pet } from "../../rules/components/Pet.js";
import { PetState } from "../../rules/components/PetState.js";
import { Faction } from "../../rules/components/Faction.js";
import { Vitality } from "../../rules/components/Vitality.js";
import { Position } from "../../rules/components/Position.js";

const INSTALLED_KEY = Symbol.for('jshack:petWiring:installed');

// Command → state mapping
const COMMAND_TO_STATE = {
  follow: 'following',
  stay: 'staying',
  guard: 'guarding',
  aggressive: 'aggressive',
  idle: 'idle',
};

// State rotation cycle for the rotate button
const STATE_ORDER = ['following', 'staying', 'guarding', 'aggressive', 'idle'];

// Reverse: state → command name for events
const STATE_TO_COMMAND = {
  following: 'follow',
  staying: 'stay',
  guarding: 'guard',
  aggressive: 'aggressive',
  idle: 'idle',
};

/**
 * Apply a command to a single entity's PetState.
 * Returns true if state actually changed.
 */
function applyCommand(petState, command, entityPos) {
  const targetState = COMMAND_TO_STATE[command];
  if (!targetState) return false;

  const prevState = petState.state;
  petState.state = targetState;

  if (targetState === 'staying' || targetState === 'guarding') {
    petState.targetX = entityPos?.x ?? null;
    petState.targetY = entityPos?.y ?? null;
  } else {
    petState.targetX = null;
    petState.targetY = null;
  }
  petState.targetItemId = 0;

  return prevState !== targetState;
}

/**
 * Rotate to the next command in the cycle.
 * Returns { changed: boolean, command: string }.
 */
function rotateState(petState, entityPos) {
  const currentIndex = STATE_ORDER.indexOf(petState.state);
  const nextState = currentIndex >= 0
    ? STATE_ORDER[(currentIndex + 1) % STATE_ORDER.length]
    : 'following';
  const command = STATE_TO_COMMAND[nextState] || 'follow';
  const changed = applyCommand(petState, command, entityPos);
  return { changed, command };
}

/**
 * Ensure PetState exists on an entity, creating it if needed.
 */
function ensurePetState(world, entityId, entityPos, playerPos) {
  let ps = world.get(entityId, PetState);
  if (!ps) {
    world.add(entityId, PetState, {
      state: 'following',
      targetX: null,
      targetY: null,
      targetItemId: 0,
      stateEnteredTurn: world.step,
      lastPlayerX: playerPos?.x ?? null,
      lastPlayerY: playerPos?.y ?? null,
      commandCooldown: 0,
    });
    ps = world.get(entityId, PetState);
  }
  return ps;
}

/**
 * @param {object} deps
 * @param {object} deps.world
 * @param {() => ({id:number, pos:{x:number,y:number}}|null)} deps.playerEntity
 */
export function installPetWiring({ world, playerEntity }) {
  if (world[INSTALLED_KEY]) return;
  world[INSTALLED_KEY] = true;

  /**
   * Iterate over all commandable creatures (pets first, then summoned).
   * Yields { id, pos, petState, eventName } for each.
   */
  function* allCommandableCreatures(playerPos) {
    // Pets
    for (const [petId, _pet, vit] of world.query(Pet, Vitality)) {
      if (!vit || vit.hp <= 0) continue;
      const pos = world.get(petId, Position);
      if (!pos) continue;
      const ps = ensurePetState(world, petId, pos, playerPos);
      yield { id: petId, pos, petState: ps, eventName: 'pet:state:changed', extraKey: 'petId' };
      break; // Only one pet for now
    }
    // Summoned creatures
    for (const [sumId, fac, vit] of world.query(Faction, Vitality)) {
      if (!fac || fac.key !== 'summoned') continue;
      if (!vit || vit.hp <= 0) continue;
      const pos = world.get(sumId, Position);
      if (!pos) continue;
      const ps = world.get(sumId, PetState);
      if (!ps) continue;
      yield { id: sumId, pos, petState: ps, eventName: 'summon:state:changed', extraKey: 'id' };
    }
  }

  // Handle UI pet commands (instant, no tick consumed)
  window.addEventListener('ui:petCommand', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const command = e?.detail?.command;
    if (!command || command === 'fetch') return; // TODO: fetch needs item selection

    const pe = playerEntity();
    const playerPos = pe ? world.get(pe.id, Position) : null;

    for (const creature of allCommandableCreatures(playerPos)) {
      const prevState = creature.petState.state;
      const changed = applyCommand(creature.petState, command, creature.pos);
      if (changed) {
        creature.petState.stateEnteredTurn = world.step;
        creature.petState.commandCooldown = 0;
        try {
          world.emit?.(creature.eventName, {
            [creature.extraKey]: creature.id,
            prevState,
            newState: creature.petState.state,
            command,
          });
        } catch (e) { console.debug(`[petWiring] emit ${creature.eventName} failed:`, e); }
      }
    }
  });

  // Rotate pet state through common commands (instant, no tick)
  window.addEventListener('ui:rotatePetState', () => {
    const pe = playerEntity();
    const playerPos = pe ? world.get(pe.id, Position) : null;

    for (const creature of allCommandableCreatures(playerPos)) {
      const prevState = creature.petState.state;
      const { changed, command } = rotateState(creature.petState, creature.pos);
      if (changed) {
        creature.petState.stateEnteredTurn = world.step;
        creature.petState.commandCooldown = 0;
        try {
          world.emit?.(creature.eventName, {
            [creature.extraKey]: creature.id,
            prevState,
            newState: creature.petState.state,
            command,
          });
        } catch (e) { console.debug(`[petWiring] emit ${creature.eventName} failed:`, e); }
      }
    }
  });

  // Pet state UI updates (messages handled in messageWiring)
  world.on('pet:state:changed', ({ newState }) => {
    try {
      window.dispatchEvent(new CustomEvent('ui:updatePetButton', {
        detail: { state: newState }
      }));
    } catch (e) { console.debug('[petWiring] dispatch ui:updatePetButton:', e); }
  });

  world.on('pet:state:auto', ({ newState }) => {
    try {
      window.dispatchEvent(new CustomEvent('ui:updatePetButton', {
        detail: { state: newState }
      }));
    } catch (e) { console.debug('[petWiring] dispatch ui:updatePetButton:', e); }
  });

  // Pet deliver UI refresh
  world.on('pet:deliver', () => {
    try { window.dispatchEvent(new CustomEvent('ui:requestInventoryData')); } catch (e) { console.debug('[petWiring] dispatch ui:requestInventoryData:', e); }
  });
}
