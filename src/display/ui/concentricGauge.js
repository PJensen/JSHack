// display/ui/concentricGauge.js
// Frameworkless concentric resource gauge: health (outer), mana (middle), stamina (inner).

function clamp01(x) {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function readStoredString(key, fallback = '') {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return typeof raw === 'string' ? raw : fallback;
  } catch {
    return fallback;
  }
}

function readStoredNumber(key, fallback = 0) {
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  } catch {
    return fallback;
  }
}

function readDprCap(root) {
  const fromCss = Number.parseFloat(String(
    getComputedStyle(root).getPropertyValue('--jshack-dpr-cap') || ''
  ));
  if (Number.isFinite(fromCss) && fromCss > 0) return fromCss;

  const quality = readStoredString('jshack.quality', 'high').toLowerCase();
  if (quality === 'low') return 1;
  if (quality === 'high') return 3;

  const dprCap = Number(readStoredNumber('jshack.dprCap', 1.5));
  if (Number.isFinite(dprCap) && dprCap > 0) return dprCap;
  return 1.5;
}

function readTheme(root) {
  const css = getComputedStyle(root);
  return {
    health: css.getPropertyValue('--rg-health').trim() || '#ff4d6d',
    mana: css.getPropertyValue('--rg-mana').trim() || '#4aa3ff',
    stamina: css.getPropertyValue('--rg-stamina').trim() || '#ffd54a',
    track: css.getPropertyValue('--rg-track').trim() || 'rgba(255,255,255,0.10)',
    glow: css.getPropertyValue('--rg-glow').trim() || 'rgba(255,255,255,0.10)',
    base: Number.parseFloat(css.getPropertyValue('--rg-thickness')) || 11,
    gap: Number.parseFloat(css.getPropertyValue('--rg-gap')) || 4,
  };
}

function ringGradient(ctx, cx, cy, r, color, flash) {
  const f = flash || 0;
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.35, r * 0.1, cx, cy, r * 1.25);
  g.addColorStop(0, `rgba(255,255,255,${(0.30 + f * 0.40).toFixed(2)})`);
  g.addColorStop(0.18, color);
  g.addColorStop(0.55, color);
  g.addColorStop(1, 'rgba(0,0,0,0.06)');
  return g;
}

function drawTrack(ctx, cx, cy, r, thickness, trackColor) {
  if (!(r > 0) || !(thickness > 0)) return;
  ctx.save();
  ctx.lineWidth = thickness;
  ctx.strokeStyle = trackColor;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawArc(ctx, cx, cy, r, thickness, t, color, glowColor, flash) {
  if (!(r > 0) || !(thickness > 0)) return;
  const f = flash || 0;
  const start = -Math.PI / 2;
  const end = start + (Math.PI * 2) * clamp01(t);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineWidth = thickness;
  ctx.shadowBlur = Math.max(8, thickness * 1.2) + f * 20;
  ctx.shadowColor = color;
  ctx.strokeStyle = ringGradient(ctx, cx, cy, r, color, f);
  ctx.beginPath();
  ctx.arc(cx, cy, r, start, end);
  ctx.stroke();
  ctx.restore();

  const ex = cx + Math.cos(end) * r;
  const ey = cy + Math.sin(end) * r;
  const capR = Math.max(2, thickness * 0.42);
  ctx.save();
  const capG = ctx.createRadialGradient(ex - capR * 0.35, ey - capR * 0.35, capR * 0.1, ex, ey, capR * 1.35);
  capG.addColorStop(0, 'rgba(255,255,255,0.75)');
  capG.addColorStop(0.35, 'rgba(255,255,255,0.25)');
  capG.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = capG;
  ctx.beginPath();
  ctx.arc(ex, ey, capR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function ensureCenterReadout(root) {
  let center = root.querySelector('.rg-center');
  if (!center) {
    center = document.createElement('div');
    center.className = 'rg-center';
    Object.assign(center.style, {
      position: 'absolute',
      inset: '0',
      display: 'grid',
      placeItems: 'center',
      pointerEvents: 'none',
    });
    const box = document.createElement('div');
    box.className = 'rg-centerBox';
    Object.assign(box.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0px',
      width: '62%',
      height: '62%',
      borderRadius: '50%',
      color: 'rgba(255,255,255,0.92)',
      fontFamily: 'monospace',
    });

    // HP row
    const hpRow = document.createElement('div');
    hpRow.setAttribute('data-rg-hp', '');
    Object.assign(hpRow.style, {
      fontSize: '13px', fontWeight: '700', lineHeight: '1.15',
      color: 'var(--rg-health, #7bff7b)',
      textShadow: '0 0 6px rgba(123,255,123,0.3)',
      textAlign: 'center',
    });

    // Mana row
    const mpRow = document.createElement('div');
    mpRow.setAttribute('data-rg-mp', '');
    Object.assign(mpRow.style, {
      fontSize: '11px', fontWeight: '600', lineHeight: '1.15',
      color: 'var(--rg-mana, #55aaff)',
      textShadow: '0 0 6px rgba(85,170,255,0.3)',
      textAlign: 'center',
    });

    // Stamina row
    const stRow = document.createElement('div');
    stRow.setAttribute('data-rg-st', '');
    Object.assign(stRow.style, {
      fontSize: '11px', fontWeight: '600', lineHeight: '1.15',
      color: 'var(--rg-stamina, #ffc530)',
      textShadow: '0 0 6px rgba(255,197,48,0.3)',
      textAlign: 'center',
    });

    box.appendChild(hpRow);
    box.appendChild(mpRow);
    box.appendChild(stRow);
    center.appendChild(box);
    root.appendChild(center);
  }
  return {
    hp: root.querySelector('[data-rg-hp]'),
    mp: root.querySelector('[data-rg-mp]'),
    st: root.querySelector('[data-rg-st]'),
    box: root.querySelector('.rg-centerBox'),
  };
}

function updateReadout(readout, state) {
  if (!readout.hp && !readout.mp && !readout.st) return;
  const hpVal = Math.max(0, Math.floor(Number(state.hpValue) || 0));
  const hpMax = Math.max(1, Math.floor(Number(state.hpMax) || 1));
  const mpVal = Math.max(0, Math.floor(Number(state.manaValue) || 0));
  const mpMax = Math.max(1, Math.floor(Number(state.manaMax) || 1));
  const stVal = Math.max(0, Math.floor(Number(state.staminaValue) || 0));
  const stMax = Math.max(1, Math.floor(Number(state.staminaMax) || 1));
  if (readout.hp) readout.hp.textContent = `${hpVal}/${hpMax}`;
  if (readout.mp) readout.mp.textContent = `${mpVal}/${mpMax}`;
  if (readout.st) readout.st.textContent = `${stVal}/${stMax}`;
}

export function createConcentricGauge(root, initial = {}, opts = {}) {
  if (!root) throw new Error('createConcentricGauge(root): root is required');

  Object.assign(root.style, {
    width: root.style.width || 'min(188px, 44vw)',
    height: root.style.height || 'min(188px, 44vw)',
    borderRadius: root.style.borderRadius || '50%',
    // Preserve host positioning (e.g., HUD uses position:fixed for corner anchoring).
    position: root.style.position || 'relative',
    overflow: root.style.overflow || 'hidden',
    display: root.style.display || 'block',
    background:
      'radial-gradient(80px 80px at 35% 30%, rgba(255,255,255,0.12), transparent 55%),' +
      'radial-gradient(190px 170px at 70% 70%, rgba(255,255,255,0.06), transparent 55%),' +
      'var(--rg-bg, rgba(255,255,255,0.03))',
    boxShadow: '0 16px 34px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.10)',
  });

  root.style.setProperty('--rg-thickness', root.style.getPropertyValue('--rg-thickness') || '11');
  root.style.setProperty('--rg-gap', root.style.getPropertyValue('--rg-gap') || '4');
  root.style.setProperty('--rg-track', root.style.getPropertyValue('--rg-track') || 'rgba(255,255,255,0.10)');
  root.style.setProperty('--rg-glow', root.style.getPropertyValue('--rg-glow') || 'rgba(255,255,255,0.10)');
  root.style.setProperty('--rg-health', root.style.getPropertyValue('--rg-health') || '#7bff7b');
  root.style.setProperty('--rg-mana', root.style.getPropertyValue('--rg-mana') || '#55aaff');
  root.style.setProperty('--rg-stamina', root.style.getPropertyValue('--rg-stamina') || '#ffc530');

  const canvas = root.querySelector('canvas') || document.createElement('canvas');
  if (!canvas.parentNode) root.appendChild(canvas);
  Object.assign(canvas.style, {
    width: '100%',
    height: '100%',
    display: 'block',
  });
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('createConcentricGauge: 2d context unavailable');

  const showReadout = opts.showReadout !== false;
  const readout = showReadout ? ensureCenterReadout(root) : { hp: null, mp: null, st: null, box: null };

  const state = {
    health: clamp01(initial.health ?? 1),
    mana: clamp01(initial.mana ?? 1),
    stamina: clamp01(initial.stamina ?? 1),
    hpValue: Number(initial.hpValue ?? 0),
    hpMax: Number(initial.hpMax ?? 1),
    manaValue: Number(initial.manaValue ?? 0),
    manaMax: Number(initial.manaMax ?? 1),
    staminaValue: Number(initial.staminaValue ?? 0),
    staminaMax: Number(initial.staminaMax ?? 1),
    anim: null,
  };

  const flash = { health: 0, mana: 0, stamina: 0 };
  let flashRaf = 0;
  let flashT = 0;
  const FLASH_DECAY = 3.5;

  function tickFlash() {
    const now = performance.now();
    const dt = Math.min(0.1, (now - flashT) / 1000);
    flashT = now;
    flash.health = Math.max(0, flash.health - dt * FLASH_DECAY);
    flash.mana = Math.max(0, flash.mana - dt * FLASH_DECAY);
    flash.stamina = Math.max(0, flash.stamina - dt * FLASH_DECAY);
    draw();
    if (flash.health > 0.01 || flash.mana > 0.01 || flash.stamina > 0.01) {
      flashRaf = requestAnimationFrame(tickFlash);
    } else {
      flash.health = flash.mana = flash.stamina = 0;
      flashRaf = 0;
      draw();
    }
  }

  function triggerFlash(ring) {
    flash[ring] = 1;
    if (!flashRaf) {
      flashT = performance.now();
      flashRaf = requestAnimationFrame(tickFlash);
    }
  }

  function sizeCanvas() {
    const rect = root.getBoundingClientRect();
    const cap = Math.max(1, readDprCap(root));
    const raw = Math.max(1, window.devicePixelRatio || 1);
    const dpr = Math.max(1, Math.min(raw, cap));
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h };
  }

  function draw() {
    const { w, h } = sizeCanvas();
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const theme = readTheme(root);

    const thHealth = Math.round(theme.base * 1.80);
    const thMana = Math.round(theme.base * 1.20);
    const thStamina = Math.round(theme.base * 0.90);

    const outerPad = Math.round(theme.base * 0.9);
    const maxR = Math.min(w, h) / 2 - outerPad;

    if (!(maxR > 0)) {
      updateReadout(readout, state);
      return;
    }

    const rHealth = maxR - thHealth / 2;
    const rMana = rHealth - thHealth / 2 - theme.gap - thMana / 2;
    const rStamina = rMana - thMana / 2 - theme.gap - thStamina / 2;

    if (!(rHealth > 0) || !(rMana > 0) || !(rStamina > 0)) {
      return;
    }

    drawTrack(ctx, cx, cy, rHealth, thHealth, theme.track);
    drawTrack(ctx, cx, cy, rMana, thMana, theme.track);
    drawTrack(ctx, cx, cy, rStamina, thStamina, theme.track);

    drawArc(ctx, cx, cy, rHealth, thHealth, state.health, theme.health, theme.glow, flash.health);
    drawArc(ctx, cx, cy, rMana, thMana, state.mana, theme.mana, theme.glow, flash.mana);
    drawArc(ctx, cx, cy, rStamina, thStamina, state.stamina, theme.stamina, theme.glow, flash.stamina);

    ctx.save();
    const vR = Math.max(2, rStamina - thStamina * 0.8);
    const vignette = ctx.createRadialGradient(cx, cy, vR * 0.25, cx, cy, vR * 1.15);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = vignette;
    ctx.beginPath();
    ctx.arc(cx, cy, vR * 1.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    updateReadout(readout, state);
  }

  function stop() {
    if (state.anim) {
      cancelAnimationFrame(state.anim.raf);
      state.anim = null;
    }
  }

  function set(values = {}) {
    stop();
    if ('health' in values) {
      const v = clamp01(values.health);
      if (Math.abs(v - state.health) > 0.005) triggerFlash('health');
      state.health = v;
    }
    if ('mana' in values) {
      const v = clamp01(values.mana);
      if (Math.abs(v - state.mana) > 0.005) triggerFlash('mana');
      state.mana = v;
    }
    if ('stamina' in values) {
      const v = clamp01(values.stamina);
      if (Math.abs(v - state.stamina) > 0.005) triggerFlash('stamina');
      state.stamina = v;
    }
    if ('hpValue' in values) state.hpValue = Number(values.hpValue ?? state.hpValue);
    if ('hpMax' in values) state.hpMax = Number(values.hpMax ?? state.hpMax);
    if ('manaValue' in values) state.manaValue = Number(values.manaValue ?? state.manaValue);
    if ('manaMax' in values) state.manaMax = Number(values.manaMax ?? state.manaMax);
    if ('staminaValue' in values) state.staminaValue = Number(values.staminaValue ?? state.staminaValue);
    if ('staminaMax' in values) state.staminaMax = Number(values.staminaMax ?? state.staminaMax);
    draw();
    return api;
  }

  function animateTo(target = {}, ms = 200) {
    stop();
    if ('health' in target && Math.abs(clamp01(target.health ?? state.health) - state.health) > 0.005) triggerFlash('health');
    if ('mana' in target && Math.abs(clamp01(target.mana ?? state.mana) - state.mana) > 0.005) triggerFlash('mana');
    if ('stamina' in target && Math.abs(clamp01(target.stamina ?? state.stamina) - state.stamina) > 0.005) triggerFlash('stamina');
    const duration = Math.max(1, Number(ms) || 1);
    const start = { health: state.health, mana: state.mana, stamina: state.stamina };
    const end = {
      health: clamp01(target.health ?? state.health),
      mana: clamp01(target.mana ?? state.mana),
      stamina: clamp01(target.stamina ?? state.stamina),
    };

    if ('hpValue' in target) state.hpValue = Number(target.hpValue ?? state.hpValue);
    if ('hpMax' in target) state.hpMax = Number(target.hpMax ?? state.hpMax);
    if ('manaValue' in target) state.manaValue = Number(target.manaValue ?? state.manaValue);
    if ('manaMax' in target) state.manaMax = Number(target.manaMax ?? state.manaMax);
    if ('staminaValue' in target) state.staminaValue = Number(target.staminaValue ?? state.staminaValue);
    if ('staminaMax' in target) state.staminaMax = Number(target.staminaMax ?? state.staminaMax);

    const t0 = performance.now();
    const frame = (now) => {
      const t = clamp01((now - t0) / duration);
      const e = easeInOutCubic(t);
      state.health = lerp(start.health, end.health, e);
      state.mana = lerp(start.mana, end.mana, e);
      state.stamina = lerp(start.stamina, end.stamina, e);
      draw();
      if (t < 1) state.anim.raf = requestAnimationFrame(frame);
      else stop();
    };
    state.anim = { raf: requestAnimationFrame(frame) };
    return api;
  }

  const ro = typeof ResizeObserver !== 'undefined'
    ? new ResizeObserver(() => draw())
    : null;
  if (ro) ro.observe(root);

  function destroy() {
    stop();
    if (flashRaf) { cancelAnimationFrame(flashRaf); flashRaf = 0; }
    if (ro) ro.disconnect();
  }

  const api = { set, animateTo, stop, draw, destroy };
  draw();
  return api;
}
