import * as Components from "../../src/rules/components/index.js";
import * as Archetypes from "../../src/rules/archetypes/index.js";
import * as ECS from "../../src/lib/ecs-js/index.js";

// -------------------------------------------------------------
// Minimal headless runner: deterministic, no DOM, no RAF
// Public API:
//   createHeadless({ seed })
//   .spawn(archetypeName)
//   .attack(targetId, channels[])
//   .drink(actorId, itemId, targetId?)
//   .step(n)
//   .save() / .load(snapshot)
//   .on(event, handler)
// -------------------------------------------------------------

// --- systems (lean; uses Components.*) ---
function resolveDamageSystem(world) {
  const ev = world.resources.events;
  for (const [id, dmg, anat, res, phys] of world.query(
    Components.DamageSpec,
    Components.Anatomy,
    Components.Resistances,
    Components.Physiology
  )) {
    const part = pickPart(anat.parts, world.rand);
    const wound = resolveHitAgainstPart(dmg, res, phys, part);
    const ws = world.getOrAdd(id, Components.Wounds, { list: [] });
    ws.list.push(wound);
    ev.emit("wound", { entity: id, wound });
    world.remove(id, Components.DamageSpec); // one-shot payload
  }
}

function woundProgressionSystem(world) {
  const ev = world.resources.events;
  for (const [id, ws] of world.query(Components.Wounds)) {
    let changed = false;
    for (const w of ws.list) {
      if (w.bleedMlPerMin > 0) {
        w.bloodLoss = (w.bloodLoss || 0) + w.bleedMlPerMin / 60;
        w.bleedMlPerMin = Math.max(0, w.bleedMlPerMin - 0.5);
        changed = true;
      }
      w.severity = Math.max(0, w.severity - 0.01);
    }
    if (changed) ev.emit("woundTick", { entity: id, wounds: ws.list });
  }
}

function woundCleanupSystem(world) {
  for (const [id, ws] of world.query(Components.Wounds)) {
    const before = ws.list.length;
    ws.list = ws.list.filter(
      (w) => w.severity > 0.02 || (w.bleedMlPerMin || 0) > 0.1
    );
    if (ws.list.length === 0) world.remove(id, Components.Wounds);
    if (ws.list.length !== before)
      world.resources.events.emit("woundCleanup", { entity: id });
  }
}

// --- potions: intents -> effects/channels ---
function drinkSystem(world) {
  for (const [actor, intent] of world.query(Components.DrinkIntent)) {
    if (!world.has(intent.itemId, Components.Potion)) {
      world.remove(actor, Components.DrinkIntent);
      continue;
    }
    const pot = world.get(intent.itemId, Components.Potion);
    const target = intent.targetId || actor;

    // consume dose
    pot.doses -= 1;
    if (pot.doses <= 0) world.destroy(intent.itemId);

    // immediate channels (beneficial/harmful in same model)
    if (pot.channels?.length) {
      const spec = world.getOrAdd(target, Components.DamageSpec, {
        channels: [],
      });
      spec.channels.push(...pot.channels);
    }

    // staged effects
    const ae = world.getOrAdd(target, Components.ActiveEffects, {
      effects: [],
    });
    for (const e of pot.effects) {
      const same = ae.effects.filter((x) => x.key === e.key);
      if (e.stack === "refresh" && same.length) {
        for (const x of same) {
          x.potency = e.potency;
          x.onsetLeft = e.onset;
          x.peakLeft = e.peak;
          x.turnsLeft = e.duration;
        }
      } else if (e.stack === "cap" && same.length >= (e.maxStacks ?? 1)) {
        strongest(same).turnsLeft = e.duration;
      } else {
        ae.effects.push({
          key: e.key,
          potency: e.potency,
          onsetLeft: e.onset,
          peakLeft: e.peak,
          turnsLeft: e.duration,
          startedAtTurn: world.step,
          sourceId: intent.itemId,
          meta: { route: pot.route, name: pot.name },
        });
      }
    }

    // rebound/hangover
    if (pot.toxicity?.hangover) {
      const delay = Math.max(1, Math.round(meanDuration(pot.effects) * 0.6));
      ae.effects.push({
        key: "hangover",
        potency: pot.toxicity.hangover,
        onsetLeft: delay,
        peakLeft: 0,
        turnsLeft: Math.max(2, delay),
        startedAtTurn: world.step,
        sourceId: intent.itemId,
        meta: { name: `${pot.name} (rebound)` },
      });
    }

    world.remove(actor, Components.DrinkIntent);
    world.resources.events.emit("drank", {
      actor,
      itemId: intent.itemId,
      target,
    });
  }
}

function effectTickSystem(world) {
  for (const [id, ae] of world.query(Components.ActiveEffects)) {
    let changed = false;

    for (const e of ae.effects) {
      if (e.onsetLeft > 0) e.onsetLeft--;
      else if (e.peakLeft > 0) e.peakLeft--;
      if (e.turnsLeft > 0) e.turnsLeft--;

      const phase =
        e.onsetLeft > 0
          ? 0.25
          : e.peakLeft > 0
          ? 1.0
          : e.turnsLeft > 0
          ? 0.6
          : 0;

      if (phase > 0) {
        switch (e.key) {
          case "regen": {
            const ws = world.get(id, Components.Wounds);
            if (ws?.list?.length) {
              const w = ws.list[ws.list.length - 1];
              w.severity = Math.max(0, w.severity - 0.05 * e.potency * phase);
              w.bleedMlPerMin = Math.max(
                0,
                w.bleedMlPerMin - 2 * e.potency * phase
              );
              changed = true;
            }
            break;
          }
          case "coagulate": {
            const ws = world.get(id, Components.Wounds);
            if (ws?.list?.length) {
              for (const w of ws.list)
                w.bleedMlPerMin = Math.max(
                  0,
                  w.bleedMlPerMin - 6 * e.potency * phase
                );
              changed = true;
            }
            break;
          }
          case "stoneSkin": {
            const r = world.get(id, Components.Resistances);
            if (r?.kinetic) {
              r.kinetic.DR += Math.round(2 * e.potency * phase);
              r.kinetic.bluntMult *= 0.98;
            }
            break;
          }
          case "haste": {
            world.resources.tempHaste ??= new Set();
            world.resources.tempHaste.add(id);
            break;
          }
          case "antirad": {
            const ws = world.get(id, Components.Wounds);
            if (ws?.list?.length) {
              for (const w of ws.list)
                if (w.kinds?.includes("irradiation"))
                  w.severity = Math.max(
                    0,
                    w.severity - 0.03 * e.potency * phase
                  );
              changed = true;
            }
            break;
          }
          case "hangover": {
            world.resources.tempHangover ??= new Set();
            world.resources.tempHangover.add(id);
            break;
          }
        }
      }
    }

    const before = ae.effects.length;
    ae.effects = ae.effects.filter((e) => e.turnsLeft > 0);
    if (changed || ae.effects.length !== before) {
      if (ae.effects.length === 0) world.remove(id, Components.ActiveEffects);
      world.resources.events.emit("effectsChanged", {
        entity: id,
        effects: ae.effects,
      });
    }
  }
}

// --- helpers shared by systems ---
function pickPart(parts, rand) {
  const r = rand();
  let acc = 0;
  for (const p of parts) {
    acc += p.vol;
    if (r <= acc) return p;
  }
  return parts[parts.length - 1];
}

function resolveHitAgainstPart(dmg, res, phys, part) {
  let residual = 0;
  const notes = [];

  for (const c of dmg.channels) {
    if (c.kind === "kinetic") {
      const DR = res.kinetic?.DR ?? 0;
      const mode = c.mode ?? "blunt";
      const mult =
        (mode === "blunt"
          ? res.kinetic?.bluntMult
          : mode === "slash"
          ? res.kinetic?.slashMult
          : res.kinetic?.pierceMult) ?? 1;
      const after = Math.max(0, c.dose - DR) * mult;
      residual += after;
      notes.push(`K:${after | 0}J/${mode}`);
    } else if (c.kind === "thermal") {
      const m = res.thermal?.burnMult ?? 1;
      residual += (c.dose * m) / 10; // fold into same scale roughly
      notes.push("T");
    } else if (c.kind === "chemical") {
      const key =
        c.agent === "solvent"
          ? "solventMult"
          : c.agent === "acid"
          ? "acidMult"
          : c.agent === "base"
          ? "baseMult"
          : "toxMult";
      const m = res.chemical?.[key] ?? 1;
      residual += c.dose * m * 8;
      notes.push(`C:${c.agent || "chem"}`);
    } else if (c.kind === "electric") {
      const ohms = res.electric?.ohms ?? 1000;
      const fib = res.electric?.fibrillationA ?? 0.03;
      const amps = c.dose / Math.max(1, ohms);
      residual +=
        Math.max(0, amps - fib) *
        (c.durationMs ? c.durationMs / 1000 : 0.05) *
        200;
      notes.push("E");
    } else if (c.kind === "bio") {
      residual += c.dose * 30;
      notes.push("B");
    } else if (c.kind === "radiation") {
      const rt = c.radType || "gamma";
      residual += c.dose * (res.radiation?.[rt] ?? 1) * 2;
      notes.push("R");
    }
  }

  const triage = phys?.kineticTriageDiv ?? 300;
  const severity = clamp(residual / triage, 0, 1);

  const kinds = [];
  if (dmg.channels.some((c) => c.kind === "kinetic")) kinds.push("concussive");
  if (dmg.channels.some((c) => c.kind === "thermal")) kinds.push("burn");
  if (dmg.channels.some((c) => c.kind === "chemical")) kinds.push("chemical");
  if (dmg.channels.some((c) => c.kind === "electric")) kinds.push("shock");
  if (dmg.channels.some((c) => c.kind === "radiation"))
    kinds.push("irradiation");

  const baseBleed = part.tags?.includes("digit")
    ? 5
    : part.id.startsWith("neck")
    ? 120
    : part.id.startsWith("head")
    ? 80
    : 25;

  return {
    part: part.id,
    kinds,
    severity,
    bleedMlPerMin:
      (part.vital ? 1.2 : 1.0) * (part.bleedCoeff ?? 1) * baseBleed * severity,
    pain: severity * (phys?.painMult ?? 1),
    fractures: false,
    burnDegree: dmg.channels.some((c) => c.kind === "thermal")
      ? severity > 0.66
        ? 3
        : severity > 0.33
        ? 2
        : 1
      : 0,
    infectionRisk: dmg.channels.some((c) => c.kind === "chemical")
      ? Math.min(1, 0.2 + severity * 0.5)
      : 0.05 + severity * 0.2,
    notes: notes.join(","),
  };
}

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const strongest = (arr) =>
  arr.reduce((a, b) => (a.potency >= b.potency ? a : b));
const meanDuration = (effs) =>
  Math.max(
    1,
    Math.round(
      (effs.reduce((s, e) => s + e.duration, 0) || 0) / (effs.length || 1)
    )
  );

// --- scheduler composition ---
const tick = ECS.composeScheduler([
  resolveDamageSystem,
  drinkSystem,
  effectTickSystem,
  woundProgressionSystem,
  woundCleanupSystem,
]);

// -------------------------------------------------------------
// Factory
// -------------------------------------------------------------
export function createHeadless({ seed = 1234 } = {}) {
  const world = new ECS.World({ seed });

  // Install scheduler directly; dt is arbitrary since we're turn-based
  world.setScheduler((w, dt) => tick(w, dt));

  return {
    world,
    on: world.on,
    step(n = 1) {
      for (let i = 0; i < n; i++) world.tick(1);
      return this;
    },
    save() {
      return ECS.serializeWorld
        ? ECS.serializeWorld(world)
        : JSON.stringify(world);
    },
    load(snapshot) {
      if (ECS.deserializeWorld) ECS.deserializeWorld(world, snapshot);
      else throw new Error("deserializeWorld not available in ECS index.js");
      return this;
    },

    // convenience spawners
    spawn(name) {
      const arch = Archetypes[name];
      if (!arch) throw new Error(`Archetype not found: ${name}`);
      return ECS.createFrom ? ECS.createFrom(world, arch) : (() => {
        // Fallback: minimal apply if createFrom not available
        const id = world.create();
        if (arch && Array.isArray(arch.steps)) {
          for (const step of arch.steps) {
            if (step && step.t === 'comp') {
              const data = typeof step.init === 'function' ? step.init({}, world, id) : step.init;
              world.add(id, step.Comp, data);
            }
          }
        }
        return id;
      })();
    },

    attack(targetId, channels) {
      world.add(targetId, Components.DamageSpec, {
        channels: channels.slice(),
      });
      return this;
    },

    drink(actorId, itemId, targetId = actorId) {
      world.add(actorId, Components.DrinkIntent, { itemId, targetId });
      return this;
    },
  };
}

// -------------------------------------------------------------
// tiny smoke if run directly (browser console-friendly)
// -------------------------------------------------------------
// Example:
const sim = createHeadless({ seed: 1337 });
const slime = sim.spawn('Slime');
sim.attack(slime, [{ kind:'kinetic', dose:500, unit:'J', mode:'blunt' }]).step(3);
