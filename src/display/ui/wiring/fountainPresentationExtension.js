import { defineExtension } from "../../../lib/ecs-js/index.js";
import { Particle } from "../../passes/vfx/particles/particlePool.js";
import { FountainDrinkResolved } from "../../../events/FountainDrinkResolved.js";
import { FountainDipResolved } from "../../../events/FountainDipResolved.js";

const FOUNTAIN_PRESENTATION_KEY = Symbol.for("jshack:display:fountainPresentation");

function burst(fx, pos, hexColor, count) {
  const r = parseInt(hexColor.slice(1, 3), 16);
  const g = parseInt(hexColor.slice(3, 5), 16);
  const b = parseInt(hexColor.slice(5, 7), 16);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 0.5 + Math.random();
    fx.pool.spawn(new Particle({
      x: pos.x, y: pos.y - 0.15,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.4,
      ax: 0, ay: 1.2,
      life: 0.4 + Math.random() * 0.4,
      size0: 0.18, size1: 0.04,
      r, g, b, a0: 0.85,
    }));
  }
}

const DRINK_STATUS = Object.freeze({
  buff: ["BLESSED!", "#ffdd44", 12],
  see_invisible: ["SIXTH SENSE!", "#bb88ff", 12],
  curse: ["CURSED!", "#aa33cc", 14],
  creature: ["SOMETHING STIRS!", "#ff4466", 16],
  teleport: ["WARPED!", "#44ddff", 14],
  gush: ["ERUPTION!", "#3399ff", 24],
  wish: ["A BOON!", "#ffee88", 20],
});

const DIP_STATUS = Object.freeze({
  uncurse: ["CLEANSED", "#88ccff", 10], bless: ["BLESSED", "#ffee88", 14],
  curse: ["CURSED!", "#aa33cc", 14], rust: ["CORRODED!", "#cc6633", 10],
  blessedResist: ["RESISTED", "#ffee88", 8], resist: ["NO EFFECT", "#88aacc", 6],
  waterlogged: ["WATERLOGGED", "#6aa7d8", 8], soggy: ["SOGGY", "#8fa36b", 8],
  swollen: ["SWOLLEN", "#b3895d", 8], diluted: ["DILUTED", "#7ba8c9", 8],
  creature: ["SOMETHING STIRS!", "#ff4466", 16],
});

export function createFountainPresentationExtension({ ftext, fx, getPosition, isVisibleAt }) {
  const canShow = (pos) => !!pos && (typeof isVisibleAt !== "function" || isVisibleAt(pos.x, pos.y));
  return defineExtension("jshack:display:fountainPresentation", (world) => {
    const offDrink = world.on(FountainDrinkResolved, (event) => {
      const pos = getPosition(event.targetId);
      if (!canShow(pos)) return;
      if (event.effect === "heal" || event.effect === "mana") {
        const color = event.effect === "heal" ? "#44ff88" : "#6699ff";
        ftext.addHeal(pos.x, pos.y - 0.45, event.amount, { color });
        burst(fx, pos, color, 8);
        return;
      }
      if (event.effect === "poison") {
        ftext.addDamage(pos.x, pos.y - 0.45, event.amount, { color: "#88ff33" });
        burst(fx, pos, "#66cc22", 8);
        return;
      }
      if (event.effect === "gold") return burst(fx, pos, "#ffcc00", 10);
      const spec = DRINK_STATUS[event.effect];
      if (!spec || (event.effect === "creature" && !event.spawnedName)) return;
      ftext.addStatus(pos.x, pos.y - 0.45, spec[0], { color: spec[1], life: 1.3, scaleStart: 1.4, scaleEnd: 1 });
      burst(fx, pos, spec[1], spec[2]);
      if (event.effect === "wish") burst(fx, pos, "#ffffff", 12);
    });
    const offDip = world.on(FountainDipResolved, (event) => {
      const pos = getPosition(event.targetId);
      if (!canShow(pos)) return;
      const spec = DIP_STATUS[event.effect];
      if (spec && (event.effect !== "creature" || event.spawnedName)) {
        ftext.addStatus(pos.x, pos.y - 0.45, spec[0], { color: spec[1], life: 1.2, scaleStart: 1.3, scaleEnd: 1 });
        burst(fx, pos, spec[1], spec[2]);
      } else if (["wet", "nothing"].includes(event.effect)) burst(fx, pos, "#5588bb", 6);
    });
    return () => { offDrink(); offDip(); };
  }, { key: FOUNTAIN_PRESENTATION_KEY });
}
