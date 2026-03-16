// src/display/ui/wiring/floatTextWiring.js
// Float text + proc VFX wiring: vampiric, thorns, burning, fierce, healed,
// died (pet UI), damaged, status, ranged:no-ammo, attack:insufficient-stamina.

import { Particle } from "../../passes/vfx/particles/particlePool.js";
import { normalizeStatusEvent } from "../../../shared/events/statusEvent.js";

const _installed = Symbol.for('jshack:display:floatTextWiring:installed');

const _staminaLines = [
  'Too exhausted!',
  'Your arms feel heavy...',
  'You can barely lift your weapon!',
  'You gasp for breath...',
  'Your muscles refuse!',
  'Not enough strength...',
  'You stagger with fatigue!',
  'Your body protests!',
];

const STATUS_LABEL_BY_KIND = Object.freeze({
  miss: 'MISS',
  immune: 'IMMUNE',
  resist: 'RESIST',
  taunt: '!',
  alert: '!',
});

const STATUS_LABEL_BY_EFFECT = Object.freeze({
  taunt: '!',
  stoneskin: 'STONESKIN',
  resist_fire: 'FIRE RESIST',
  resist_poison: 'POISON RESIST',
  resist_electric: 'LIGHTNING RESIST',
  resist_acid: 'ACID RESIST',
});

function resolveStatusLabel(kind, effect) {
  const effectKey = String(effect || '').trim().toLowerCase();
  if (effectKey && STATUS_LABEL_BY_EFFECT[effectKey]) return STATUS_LABEL_BY_EFFECT[effectKey];
  const kindKey = String(kind || '').trim().toLowerCase();
  if (kindKey && STATUS_LABEL_BY_KIND[kindKey]) return STATUS_LABEL_BY_KIND[kindKey];
  return kindKey ? kindKey.toUpperCase() : 'STATUS';
}

/**
 * Install float text + proc VFX event listeners.
 * @param {{
 *   world: import('../../../lib/ecs-js/index.js').World,
 *   ftext: { addStatus: Function, addHeal: Function, addDamage: Function },
 *   fx: { pool: { spawn: Function } },
 *   getPosition: (id: number) => ({ x:number, y:number } | null),
 *   isVisibleAt?: (x:number, y:number) => boolean,
 *   isPet: (id: number) => boolean,
 *   isPlayer: (id: number) => boolean,
 * }} deps
 */
export function installFloatTextWiring({ world, ftext, fx, getPosition, isVisibleAt, isPet, isPlayer }) {
  if (/** @type {any} */ (world)[_installed]) return;
  /** @type {any} */ (world)[_installed] = true;
  const canShowAt = (x, y) => (
    Number.isFinite(Number(x))
    && Number.isFinite(Number(y))
    && (typeof isVisibleAt !== 'function' || !!isVisibleAt(Number(x), Number(y)))
  );

  // Proc VFX: vampiric life-steal
  world.on('proc:vampiric', ({ actor, target, amount }) => {
    const apos = getPosition(Number(actor || 0));
    const tpos = getPosition(Number(target || 0));
    if (!apos || !canShowAt(apos.x, apos.y)) return;
    ftext.addStatus(apos.x, apos.y - 0.3, 'LIFESTEAL', { color: '#ff4040', life: 0.6 });
    if (tpos) {
      const dx = apos.x - tpos.x, dy = apos.y - tpos.y;
      const dist = Math.hypot(dx, dy) || 1;
      for (let i = 0; i < 6; i++) {
        const spd = 1.5 + Math.random() * 1.0;
        fx.pool.spawn(new Particle({
          x: tpos.x + (Math.random() - 0.5) * 0.3,
          y: tpos.y + (Math.random() - 0.5) * 0.3,
          vx: (dx / dist) * spd + (Math.random() - 0.5) * 0.5,
          vy: (dy / dist) * spd + (Math.random() - 0.5) * 0.5,
          life: 0.35 + Math.random() * 0.15,
          size0: 0.15, size1: 0.04,
          r: 200, g: 50, b: 50,
          a0: 0.85,
        }));
      }
    }
  });

  // Proc VFX: thorns retaliation
  world.on('proc:thorns', ({ actor, target }) => {
    const tpos = getPosition(Number(target || 0));
    if (!tpos || !canShowAt(tpos.x, tpos.y)) return;
    ftext.addStatus(tpos.x, tpos.y - 0.3, 'THORNS', { color: '#78ff78', life: 0.6 });
    for (let i = 0; i < 5; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = 0.8 + Math.random() * 0.6;
      fx.pool.spawn(new Particle({
        x: tpos.x, y: tpos.y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life: 0.2 + Math.random() * 0.15,
        size0: 0.12, size1: 0.03,
        r: 120, g: 255, b: 120,
        a0: 0.9,
      }));
    }
  });

  // Proc VFX: burning applied (one-shot ignite burst)
  world.on('proc:burning', ({ actor, target }) => {
    const tpos = getPosition(Number(target || 0));
    if (!tpos || !canShowAt(tpos.x, tpos.y)) return;
    ftext.addStatus(tpos.x, tpos.y - 0.3, 'BURNING', { color: '#ff6600', life: 0.6 });
    for (let i = 0; i < 8; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.6;
      const spd = 0.6 + Math.random() * 0.8;
      fx.pool.spawn(new Particle({
        x: tpos.x + (Math.random() - 0.5) * 0.2,
        y: tpos.y + (Math.random() - 0.5) * 0.2,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        ay: -0.4,
        life: 0.3 + Math.random() * 0.2,
        size0: 0.18, size1: 0.04,
        r: 255, g: 140 + (Math.random() * 60) | 0, b: 20,
        a0: 0.9,
      }));
    }
  });

  // Proc VFX: fierce bonus damage
  world.on('proc:fierce', ({ actor, target }) => {
    const tpos = getPosition(Number(target || 0));
    if (!tpos || !canShowAt(tpos.x, tpos.y)) return;
    ftext.addStatus(tpos.x, tpos.y + 0.3, '+1', { color: '#ffa040', life: 0.4 });
  });

  // Heal floating text (message handled in messageWiring)
  world.on('healed', ({ id, amount }) => {
    const pos = getPosition(Number(id || 0));
    if (pos && canShowAt(pos.x, pos.y) && Number.isFinite(amount)) {
      try { ftext.addHeal(pos.x, pos.y, amount, { color: '#7BFF7B' }); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
    }
  });

  // Pet death UI notification (message handled in messageWiring)
  world.on('died', ({ id }) => {
    if (isPet(Number(id || 0))) {
      try {
        window.dispatchEvent(new CustomEvent('ui:petExists', {
          detail: { exists: false }
        }));
      } catch (e) { console.debug('[floatTextWiring] dispatch ui:petExists:', e); }
    }
  });

  // Floating text hooks: damage (messages handled in messageWiring)
  world.on('damaged', ({ target, amount, critical, crit, at, offhand, projectileDelay }) => {
    const t = Number(target || 0) || 0;
    const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : getPosition(t);
    const hitIsPlayer = isPlayer(t);
    if (pos && canShowAt(pos.x, pos.y) && Number.isFinite(amount)) {
      const col = hitIsPlayer ? '#ff6060' : '#ffd966';
      const delay = Number(projectileDelay) || (offhand ? 0.15 : 0);
      ftext.addDamage(pos.x, pos.y, amount, { dmg: amount, color: col, crit: !!(critical || crit), delay });
    }
  });

  // Status floating text (messages handled in messageWiring)
  world.on('status', (payload) => {
    const { id, kind, effect, at, masked } = normalizeStatusEvent(payload);
    const pos = (at && typeof at.x === 'number' && typeof at.y === 'number') ? at : getPosition(Number(id || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const kindLower = (String(kind || '')).toLowerCase();
    const style = kindLower === 'miss' ? 'miss' : (kindLower === 'immune' ? 'immune' : 'status');
    const label = masked ? kindLower.toUpperCase() || 'STATUS' : resolveStatusLabel(kind, effect);
    const opts = { style };
    if (kindLower === 'taunt' || kindLower === 'alert') opts.color = '#ffdd00';
    try { ftext.addStatus(pos.x, pos.y, label, opts); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
  });

  // Ranged combat floating text (messages handled in messageWiring)
  world.on('ranged:no-ammo', ({ attacker }) => {
    const pos = getPosition(Number(attacker || 0));
    if (pos && canShowAt(pos.x, pos.y)) try { ftext.addStatus(pos.x, pos.y, 'NO AMMO', { style: 'status' }); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
  });

  // Insufficient stamina floating flavor text (message handled in messageWiring)
  world.on('attack:insufficient-stamina', ({ attacker }) => {
    const pos = getPosition(Number(attacker || 0));
    if (pos && canShowAt(pos.x, pos.y)) {
      const line = _staminaLines[Math.floor(Math.random() * _staminaLines.length)];
      try { ftext.addStatus(pos.x, pos.y - 0.3, line, { color: '#ff8c00', life: 1.0 }); } catch (e) { console.debug('[floatTextWiring] ftext failed:', e); }
    }
  });

  // Gaze stun: strong psychic lock burst on the player.
  world.on('proc:gaze:stun', ({ target }) => {
    const pos = getPosition(Number(target || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    try {
      ftext.addStatus(pos.x, pos.y - 0.45, 'MIND LOCK!', {
        color: '#ff5fd2',
        life: 1.35,
        scaleStart: 1.5,
        scaleEnd: 1.0,
      });
    } catch (e) {
      console.debug('[floatTextWiring] gaze stun ftext failed:', e);
    }
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.4 + Math.random() * 0.6;
      try {
        fx.pool.spawn(new Particle({
          x: pos.x,
          y: pos.y - 0.1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.15,
          life: 0.25 + Math.random() * 0.2,
          size0: 0.12,
          size1: 0.03,
          r: 255,
          g: 95,
          b: 210,
          a0: 0.9,
        }));
      } catch (e) {
        console.debug('[floatTextWiring] gaze stun fx failed:', e);
      }
    }
  });

  // Permanent trait gained from corpse eating
  world.on('corpse:trait-gained', ({ actor, name }) => {
    const pos = getPosition(Number(actor || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    const label = String(name || 'TRAIT').toUpperCase();
    try {
      ftext.addStatus(pos.x, pos.y - 0.5, label + '!', {
        color: '#ffd966',
        life: 1.8,
        scaleStart: 1.6,
        scaleEnd: 1.0,
      });
    } catch (e) {
      console.debug('[floatTextWiring] trait gained ftext failed:', e);
    }
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.3 + Math.random() * 0.5;
      try {
        fx.pool.spawn(new Particle({
          x: pos.x,
          y: pos.y - 0.1,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.2,
          life: 0.3 + Math.random() * 0.25,
          size0: 0.1,
          size1: 0.02,
          r: 255,
          g: 217,
          b: 102,
          a0: 0.9,
        }));
      } catch (e) {
        console.debug('[floatTextWiring] trait gained fx failed:', e);
      }
    }
  });

  // Storm lightning strike
  world.on('weather:lightning', ({ x, y, hitCount }) => {
    if (!canShowAt(x, y)) return;
    try {
      ftext.addStatus(x, y - 0.45, (hitCount | 0) > 0 ? 'ZAP!' : 'CRACK!', {
        color: '#88ccff',
        life: 1.0,
        scaleStart: 1.6,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] lightning ftext failed:', e); }
  });

  // Town bell alarm
  world.on('bell:rung', ({ targetId }) => {
    const pos = getPosition(Number(targetId || 0));
    if (pos && canShowAt(pos.x, pos.y)) {
      try { ftext.addStatus(pos.x, pos.y - 0.3, 'ALARM!', { color: '#d4a017', life: 1.2 }); } catch (e) { console.debug('[floatTextWiring] bell ftext failed:', e); }
    }
  });

  // Flying: takeoff / land float text
  world.on('proc:fly:takeoff', ({ x, y }) => {
    if (!canShowAt(x, y)) return;
    try {
      ftext.addStatus(x, y - 0.45, 'TAKES FLIGHT!', {
        color: '#7bc8ff',
        life: 1.0,
        scaleStart: 1.2,
        scaleEnd: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] fly takeoff ftext failed:', e); }
  });
  world.on('proc:fly:land', ({ x, y }) => {
    if (!canShowAt(x, y)) return;
    try {
      ftext.addStatus(x, y - 0.3, 'LANDS', {
        color: '#b08050',
        life: 0.7,
      });
    } catch (e) { console.debug('[floatTextWiring] fly land ftext failed:', e); }
  });

  world.on('trap:avoided', ({ victimId }) => {
    const pos = getPosition(Number(victimId || 0));
    if (!pos || !canShowAt(pos.x, pos.y)) return;
    try {
      ftext.addStatus(pos.x, pos.y - 0.4, 'DODGED!', {
        color: '#40e0d0',
        life: 0.9,
      });
    } catch (e) { console.debug('[floatTextWiring] trap avoided ftext failed:', e); }
  });
}
