// display/ui/charCreation.js
// Character creation screen. Pure presentation — no rules/ imports (shared/ is OK).
// Data is passed in by main.js via showCharCreation(opts).
import { versionLoaded, getVersionState } from '../../shared/version.js';
import { pickRandomCharacterName } from '../../shared/utils/characterNames.js';
import { getHighscoreVersionLabel, getHighscores } from '../../shared/tombstoneApi.js';
import { HINTS } from '../../shared/data/hints.js';

/**
 * @param {{
 *   classes: Array<{ id: string, name: string, description: string, deityName: string, deityAlignment: string }>,
 *   defaultSeed?: number,
 *   onConfirm: (result: { name: string, classId: string, seed: number }) => void,
 * }} opts
 * @returns {{ dispose: () => void }}
 */
const SAVED_NAME_KEY = 'jshack.playerName';
function readSavedName() {
  try { return localStorage.getItem(SAVED_NAME_KEY) || ''; } catch { return ''; }
}
function writeSavedName(name) {
  try { localStorage.setItem(SAVED_NAME_KEY, name); } catch {}
}

const CHAR_UI = Object.freeze({
  panelBg: 'rgba(7, 8, 10, 0.965)',
  panelText: '#dde2e8',
  boxBg: '#111214',
  boxBorder: '#4b5662',
  boxGlow: 'rgba(132, 154, 178, 0.18)',
  cardBg: '#171412',
  cardBorder: '#4f443a',
  cardSelectedBg: '#221d18',
  cardSelectedBorder: '#8f9fb2',
  inputBg: '#171412',
  inputBorder: '#5b4f44',
  inputFocus: '#9db1c7',
  accent: '#c5d4e3',
  accentMuted: '#ad9f8d',
  textMuted: '#a29686',
  textLow: '#918678',
});

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

export function showCharCreation({ classes, defaultSeed = 0xC0FFEE, onConfirm }) {
  let selectedClassId = null;
  let hintIntervalId = null;
  const savedName = readSavedName();
  const fallbackName = savedName || pickRandomCharacterName();

  // ---- backdrop (full-viewport, blocks all input) ----
  const panel = document.createElement('div');
  panel.id = 'char-creation';
  Object.assign(panel.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'auto',
    background: `
      radial-gradient(1200px 700px at 50% -10%, rgba(88, 110, 136, 0.30), transparent 60%),
      radial-gradient(1000px 700px at 50% 120%, rgba(28, 22, 16, 0.62), transparent 70%),
      ${CHAR_UI.panelBg}
    `,
    fontFamily: 'monospace', zIndex: '1400',
    color: CHAR_UI.panelText,
  });

  // ---- inner box ----
  const box = document.createElement('div');
  Object.assign(box.style, {
    width: 'min(460px, 90vw)',
    maxHeight: '92vh', overflowY: 'auto',
    textAlign: 'center',
    background: 'linear-gradient(180deg, rgba(22,18,15,0.88), rgba(14,12,10,0.92))',
    border: `1px solid ${CHAR_UI.boxBorder}`,
    borderRadius: '12px',
    padding: '24px 20px',
    backdropFilter: 'blur(1.6px)',
    boxShadow: `
      0 28px 80px rgba(0, 0, 0, 0.7),
      0 0 40px ${CHAR_UI.boxGlow},
      inset 0 0 0 1px rgba(188, 206, 224, 0.08),
      inset 0 -30px 60px rgba(112, 136, 162, 0.08)
    `,
  });

  // ---- background particle canvas (behind the box) ----
  box.style.position = 'relative';
  box.style.zIndex = '1';

  const bgCanvas = document.createElement('canvas');
  Object.assign(bgCanvas.style, {
    position: 'absolute', left: '0', top: '0',
    width: '100%', height: '100%',
    pointerEvents: 'none', zIndex: '0',
  });
  const bgCtx = bgCanvas.getContext('2d');
  let bgRafId = null;
  let bgLastT = 0;

  function resizeBgCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }
  resizeBgCanvas();
  window.addEventListener('resize', resizeBgCanvas);

  const smoke = [];
  const embers = [];
  const ash = [];
  const hazeBands = [];
  const stars = [];
  const spellMotes = [];

  for (let i = 0; i < 22; i++) {
    smoke.push({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight * (0.35 + Math.random() * 0.8),
      vy: -(6 + Math.random() * 15),
      sway: (Math.random() - 0.5) * 14,
      phase: Math.random() * Math.PI * 2,
      radius: 80 + Math.random() * 170,
      alpha: 0.07 + Math.random() * 0.11,
    });
  }

  for (let i = 0; i < 76; i++) {
    embers.push({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight * (0.55 + Math.random() * 0.5),
      vx: (Math.random() - 0.5) * 10,
      vy: -(28 + Math.random() * 76),
      life: Math.random(),
      size: 0.8 + Math.random() * 2.6,
      heat: 0.3 + Math.random() * 0.7,
      flicker: Math.random() * Math.PI * 2,
    });
  }

  for (let i = 0; i < 50; i++) {
    ash.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: -6 + Math.random() * 12,
      vy: -(2 + Math.random() * 10),
      size: 0.7 + Math.random() * 1.5,
      alpha: 0.08 + Math.random() * 0.13,
      phase: Math.random() * Math.PI * 2,
    });
  }

  for (let i = 0; i < 3; i++) {
    hazeBands.push({
      phase: Math.random() * Math.PI * 2,
      speed: 0.15 + i * 0.08,
      alpha: 0.12 + i * 0.05,
      height: 0.24 + i * 0.1,
      tilt: (Math.random() - 0.5) * 0.12,
    });
  }

  for (let i = 0; i < 24; i++) {
    stars.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * (window.innerHeight * 0.48),
      size: 0.6 + Math.random() * 1.4,
      alpha: 0.10 + Math.random() * 0.24,
      phase: Math.random() * Math.PI * 2,
      speed: 0.45 + Math.random() * 0.85,
    });
  }

  for (let i = 0; i < 14; i++) {
    spellMotes.push({
      x: Math.random() * window.innerWidth,
      y: window.innerHeight * (0.36 + Math.random() * 0.6),
      vx: (Math.random() - 0.5) * 8,
      vy: -(8 + Math.random() * 22),
      size: 1 + Math.random() * 2.5,
      alpha: 0.08 + Math.random() * 0.18,
      hue: Math.random() > 0.5 ? 198 : 214,
      phase: Math.random() * Math.PI * 2,
    });
  }

  function resetEmber(p, w, h) {
    p.x = Math.random() * w;
    p.y = h * (0.75 + Math.random() * 0.3);
    p.vx = (Math.random() - 0.5) * 10;
    p.vy = -(28 + Math.random() * 76);
    p.life = 0;
    p.size = 0.8 + Math.random() * 2.6;
    p.heat = 0.3 + Math.random() * 0.7;
    p.flicker = Math.random() * Math.PI * 2;
  }

  function bgLoop(now = 0) {
    bgRafId = requestAnimationFrame(bgLoop);
    const w = bgCanvas.width;
    const h = bgCanvas.height;
    const dt = Math.min(0.05, Math.max(0.008, (now - bgLastT) / 1000 || 0.016));
    bgLastT = now;

    bgCtx.clearRect(0, 0, w, h);

    const baseGrad = bgCtx.createLinearGradient(0, 0, 0, h);
    baseGrad.addColorStop(0, 'rgba(8, 6, 6, 0.46)');
    baseGrad.addColorStop(0.45, 'rgba(20, 10, 8, 0.22)');
    baseGrad.addColorStop(1, 'rgba(30, 12, 9, 0.42)');
    bgCtx.fillStyle = baseGrad;
    bgCtx.fillRect(0, 0, w, h);

    const fireBed = bgCtx.createRadialGradient(
      w * 0.5,
      h * 1.05,
      Math.min(w, h) * 0.05,
      w * 0.5,
      h * 1.05,
      Math.max(w, h) * 0.65,
    );
    fireBed.addColorStop(0, 'rgba(255, 130, 48, 0.18)');
    fireBed.addColorStop(0.45, 'rgba(255, 95, 34, 0.10)');
    fireBed.addColorStop(1, 'rgba(255, 74, 24, 0)');
    bgCtx.fillStyle = fireBed;
    bgCtx.fillRect(0, 0, w, h);

    for (const s of stars) {
      s.phase += dt * s.speed;
      const twinkle = 0.58 + Math.sin(s.phase * 2.2) * 0.42;
      const alpha = s.alpha * twinkle;
      bgCtx.globalAlpha = alpha;
      bgCtx.fillStyle = '#c9d0dc';
      bgCtx.beginPath();
      bgCtx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.globalAlpha = 1;
    }

    for (const m of spellMotes) {
      m.phase += dt * 1.6;
      m.x += (m.vx + Math.sin(m.phase * 1.9) * 5) * dt;
      m.y += m.vy * dt;
      if (m.y < -18 || m.x < -20 || m.x > w + 20) {
        m.x = Math.random() * w;
        m.y = h * (0.7 + Math.random() * 0.4);
      }
      const glow = bgCtx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.size * 7);
      glow.addColorStop(0, `hsla(${m.hue}, 88%, 74%, ${m.alpha * 0.9})`);
      glow.addColorStop(0.45, `hsla(${m.hue}, 90%, 61%, ${m.alpha * 0.45})`);
      glow.addColorStop(1, `hsla(${m.hue}, 88%, 48%, 0)`);
      bgCtx.fillStyle = glow;
      bgCtx.beginPath();
      bgCtx.arc(m.x, m.y, m.size * 7, 0, Math.PI * 2);
      bgCtx.fill();
    }

    for (const p of smoke) {
      p.phase += dt * 0.75;
      p.x += (p.sway + Math.sin(p.phase) * 16) * dt;
      p.y += p.vy * dt;
      if (p.y + p.radius < -20) {
        p.y = h + p.radius * (0.4 + Math.random() * 0.8);
        p.x = Math.random() * w;
        p.radius = 80 + Math.random() * 170;
        p.alpha = 0.07 + Math.random() * 0.11;
      }
      const g = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      g.addColorStop(0, `rgba(56, 46, 42, ${p.alpha})`);
      g.addColorStop(0.65, `rgba(37, 30, 28, ${p.alpha * 0.55})`);
      g.addColorStop(1, 'rgba(20, 15, 14, 0)');
      bgCtx.fillStyle = g;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      bgCtx.fill();
    }

    for (const p of ash) {
      p.phase += dt * 1.4;
      p.x += (p.vx + Math.sin(p.phase) * 5.5) * dt;
      p.y += p.vy * dt;
      if (p.y < -8 || p.x < -10 || p.x > w + 10) {
        p.x = Math.random() * w;
        p.y = h + Math.random() * 40;
      }
      bgCtx.globalAlpha = p.alpha;
      bgCtx.fillStyle = '#6f5f56';
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      bgCtx.fill();
      bgCtx.globalAlpha = 1;
    }

    for (const p of embers) {
      p.life += dt * (0.28 + p.heat * 0.45);
      p.flicker += dt * (5.2 + p.heat * 4.5);
      p.x += (p.vx + Math.sin(p.flicker) * 7) * dt;
      p.y += p.vy * dt;

      const fade = 1 - clamp01(p.life);
      const pulse = 0.55 + Math.sin(p.flicker * 1.8) * 0.45;
      const alpha = clamp01(fade * (0.4 + pulse * 0.8));

      if (p.life >= 1 || p.y < -30 || p.x < -20 || p.x > w + 20) {
        resetEmber(p, w, h);
        continue;
      }

      const size = p.size * (0.75 + p.heat * 0.8) * (0.8 + pulse * 0.4);
      const glow = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, size * 6);
      glow.addColorStop(0, `rgba(255, 240, 196, ${alpha * 0.96})`);
      glow.addColorStop(0.2, `rgba(255, 148, 56, ${alpha * 0.92})`);
      glow.addColorStop(0.58, `rgba(255, 88, 24, ${alpha * 0.48})`);
      glow.addColorStop(1, 'rgba(255, 60, 18, 0)');
      bgCtx.fillStyle = glow;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, size * 6, 0, Math.PI * 2);
      bgCtx.fill();
    }

    for (const band of hazeBands) {
      band.phase += dt * band.speed;
      const driftX = Math.sin(band.phase * 1.3 + band.tilt) * w * 0.12;
      const y = h * (0.08 + band.height);
      const grad = bgCtx.createLinearGradient(0, y - 30, w, y + 60);
      grad.addColorStop(0, `rgba(18, 14, 13, ${band.alpha * 0.25})`);
      grad.addColorStop(0.5, `rgba(22, 17, 15, ${band.alpha})`);
      grad.addColorStop(1, `rgba(15, 12, 11, ${band.alpha * 0.25})`);
      bgCtx.save();
      bgCtx.translate(driftX, 0);
      bgCtx.fillStyle = grad;
      bgCtx.fillRect(-w * 0.2, y - 70, w * 1.4, 180);
      bgCtx.restore();
    }

    const hazeTop = bgCtx.createLinearGradient(0, 0, 0, h);
    hazeTop.addColorStop(0, 'rgba(8,6,6,0.32)');
    hazeTop.addColorStop(0.36, 'rgba(9,7,7,0.10)');
    hazeTop.addColorStop(1, 'rgba(8,6,6,0.38)');
    bgCtx.fillStyle = hazeTop;
    bgCtx.fillRect(0, 0, w, h);

    const bogMist = bgCtx.createRadialGradient(
      w * 0.17,
      h * 1.02,
      Math.min(w, h) * 0.06,
      w * 0.17,
      h * 1.02,
      Math.max(w, h) * 0.46,
    );
    bogMist.addColorStop(0, 'rgba(94, 128, 83, 0.18)');
    bogMist.addColorStop(0.48, 'rgba(64, 90, 55, 0.10)');
    bogMist.addColorStop(1, 'rgba(35, 46, 33, 0)');
    bgCtx.fillStyle = bogMist;
    bgCtx.fillRect(0, 0, w, h);

    const rustBand = bgCtx.createLinearGradient(0, h * 0.72, 0, h);
    rustBand.addColorStop(0, 'rgba(96, 50, 36, 0)');
    rustBand.addColorStop(1, 'rgba(96, 50, 36, 0.16)');
    bgCtx.fillStyle = rustBand;
    bgCtx.fillRect(0, h * 0.72, w, h * 0.28);

    const steelSheen = bgCtx.createLinearGradient(0, h * 0.12, w, h * 0.20);
    steelSheen.addColorStop(0, 'rgba(178, 191, 205, 0)');
    steelSheen.addColorStop(0.5, `rgba(178, 191, 205, ${0.04 + (Math.sin(now * 0.00055) + 1) * 0.01})`);
    steelSheen.addColorStop(1, 'rgba(178, 191, 205, 0)');
    bgCtx.fillStyle = steelSheen;
    bgCtx.fillRect(0, 0, w, h * 0.42);

    const vignette = bgCtx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      Math.min(w, h) * 0.1,
      w * 0.5,
      h * 0.45,
      Math.max(w, h) * 0.68,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.8, 'rgba(0,0,0,0.42)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.74)');
    bgCtx.fillStyle = vignette;
    bgCtx.fillRect(0, 0, w, h);
  }
  bgLoop();

  // ---- title row (title + help icon) ----
  const titleRow = document.createElement('div');
  Object.assign(titleRow.style, {
    position: 'relative',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    marginBottom: '4px',
  });

  const title = document.createElement('div');
  title.textContent = 'Enter the Dungeon';
  Object.assign(title.style, {
    fontSize: '24px',
    fontWeight: 'bold',
    letterSpacing: '0.06em',
    color: '#d7e3f1',
    textTransform: 'uppercase',
    textShadow: '0 0 18px rgba(142, 170, 198, 0.28)',
  });

  const helpLink = document.createElement('a');
  helpLink.textContent = '\u2139';
  helpLink.href = './tools/help/';
  helpLink.target = '_blank';
  helpLink.rel = 'noopener';
  helpLink.title = 'Help & Reference';
  Object.assign(helpLink.style, {
    position: 'absolute', right: '0',
    width: '28px', height: '28px',
    display: 'grid', placeItems: 'center',
    borderRadius: '6px',
    border: `1px solid ${CHAR_UI.inputBorder}`,
    background: '#1a1f26',
    color: CHAR_UI.accent,
    fontSize: '16px', textDecoration: 'none',
    lineHeight: '1',
    transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
  });
  helpLink.addEventListener('pointerenter', () => {
    helpLink.style.transform = 'translateY(-1px)';
    helpLink.style.borderColor = CHAR_UI.inputFocus;
    helpLink.style.boxShadow = '0 0 16px rgba(138, 168, 198, 0.30)';
  });
  helpLink.addEventListener('pointerleave', () => {
    helpLink.style.transform = '';
    helpLink.style.borderColor = CHAR_UI.inputBorder;
    helpLink.style.boxShadow = '';
  });
  helpLink.addEventListener('pointerdown', () => { helpLink.style.transform = 'translateY(0px) scale(0.96)'; });

  titleRow.appendChild(title);
  titleRow.appendChild(helpLink);
  box.appendChild(titleRow);

  const subtitle = document.createElement('div');
  subtitle.textContent = 'Ash. Iron. Oath.';
  Object.assign(subtitle.style, {
    fontSize: '11px',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    color: CHAR_UI.textMuted,
    marginBottom: '12px',
  });
  box.appendChild(subtitle);

  // ---- version + subscribe row ----
  const versionRow = document.createElement('div');
  Object.assign(versionRow.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', marginBottom: '10px',
  });

  const versionEl = document.createElement('div');
  Object.assign(versionEl.style, {
    fontSize: '12px', color: CHAR_UI.textLow,
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
  });
  versionRow.appendChild(versionEl);

  const betaBadge = document.createElement('span');
  betaBadge.textContent = 'BETA';
  Object.assign(betaBadge.style, {
    fontSize: '10px',
    fontWeight: 'bold',
    letterSpacing: '0.10em',
    color: '#ffd7bf',
    border: '1px solid #8b4f34',
    borderRadius: '999px',
    padding: '1px 7px',
    lineHeight: '1.5',
    background: 'rgba(116,44,20,0.40)',
    boxShadow: '0 0 12px rgba(240, 112, 56, 0.15)',
  });
  versionRow.appendChild(betaBadge);
  try {
    betaBadge.animate(
      [
        { opacity: 0.65, transform: 'translateY(0px)' },
        { opacity: 1, transform: 'translateY(-1px)' },
      ],
      { duration: 1200, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
    );
  } catch {}

  const subscribeLink = document.createElement('a');
  subscribeLink.href = 'https://hackjs.substack.com/';
  subscribeLink.target = '_blank';
  subscribeLink.rel = 'noopener';
  subscribeLink.textContent = 'Subscribe to Updates';
  Object.assign(subscribeLink.style, {
    fontSize: '12px', color: CHAR_UI.accentMuted,
    textDecoration: 'none', opacity: '0.8',
  });
  subscribeLink.addEventListener('mouseenter', () => { subscribeLink.style.opacity = '1'; });
  subscribeLink.addEventListener('mouseleave', () => { subscribeLink.style.opacity = '0.8'; });
  versionRow.appendChild(subscribeLink);

  box.appendChild(versionRow);
  versionLoaded.then(() => {
    const ver = /** @type {any} */ (window).VERSION;
    if (!ver) return;

    versionEl.textContent = `v${ver}`;
    const state = getVersionState();
    if (!state.isNew) return;

    const badge = document.createElement('span');
    badge.textContent = 'NEW';
    Object.assign(badge.style, {
      fontSize: '10px',
      fontWeight: 'bold',
      letterSpacing: '0.08em',
      color: '#ffd8bf',
      background: 'rgba(116,44,20,0.42)',
      border: '1px solid #8f4e2d',
      borderRadius: '999px',
      padding: '1px 6px',
      lineHeight: '1.4',
    });
    versionEl.appendChild(badge);
    try {
      const entrance = badge.animate(
        [
          { transform: 'scale(0)', opacity: 0, filter: 'brightness(3)' },
          { transform: 'scale(4)', opacity: 1, filter: 'brightness(2.5)', offset: 0.45 },
          { transform: 'scale(3.5)', opacity: 1, filter: 'brightness(2)', offset: 0.55 },
          { transform: 'scale(1)', opacity: 1, filter: 'brightness(1.25)' },
        ],
        { duration: 520, easing: 'cubic-bezier(0.22,1.5,0.36,1)', fill: 'forwards' },
      );
      entrance.finished.then(() => {
        badge.animate(
          [
            { transform: 'translateY(0px)', opacity: 0.75, filter: 'brightness(1)' },
            { transform: 'translateY(-1px)', opacity: 1, filter: 'brightness(1.25)' },
          ],
          {
            duration: 700,
            easing: 'ease-in-out',
            direction: 'alternate',
            iterations: Infinity,
          },
        );
      });
    } catch {}
  }).catch(() => {});

  // ---- music nudge ----
  const musicNudge = document.createElement('div');
  musicNudge.textContent = '\u266B Bring your own war drums';
  Object.assign(musicNudge.style, {
    fontSize: '11px', color: CHAR_UI.textLow, fontStyle: 'italic',
    marginBottom: '20px',
  });
  box.appendChild(musicNudge);

  // ---- name + seed row ----
  const nameSeadRow = document.createElement('div');
  Object.assign(nameSeadRow.style, {
    display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end',
  });

  // name column
  const nameCol = document.createElement('div');
  Object.assign(nameCol.style, { flex: '1', minWidth: '0' });

  const nameHeader = document.createElement('div');
  Object.assign(nameHeader.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
  });

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  Object.assign(nameLabel.style, {
    display: 'block', fontSize: '13px', color: CHAR_UI.accentMuted,
    textAlign: 'left',
  });

  const nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = fallbackName;
  nameInput.maxLength = 24;
  nameInput.setAttribute('autocomplete', 'off');
  nameInput.setAttribute('autocapitalize', 'words');
  Object.assign(nameInput.style, {
    display: 'block', width: '100%', boxSizing: 'border-box',
    minHeight: '44px', padding: '8px 12px',
    fontSize: '18px', fontFamily: 'monospace',
    background: CHAR_UI.inputBg, color: CHAR_UI.panelText,
    border: `1px solid ${CHAR_UI.inputBorder}`, borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
  });
  nameInput.addEventListener('focus', () => {
    nameInput.style.borderColor = CHAR_UI.inputFocus;
    nameInput.style.boxShadow = '0 0 0 2px rgba(157, 177, 199, 0.24)';
    nameInput.style.transform = 'translateY(-1px)';
  });
  nameInput.addEventListener('blur', () => {
    nameInput.style.borderColor = CHAR_UI.inputBorder;
    nameInput.style.boxShadow = '';
    nameInput.style.transform = '';
  });

  function makeMiniBtn(label, title = '') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.title = title;
    Object.assign(btn.style, {
      border: `1px solid ${CHAR_UI.inputBorder}`,
      background: '#1b1411',
      color: CHAR_UI.accent,
      borderRadius: '999px',
      fontSize: '11px',
      minHeight: '24px',
      padding: '2px 9px',
      fontFamily: 'monospace',
      cursor: 'pointer',
      transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
      touchAction: 'manipulation',
    });
    btn.addEventListener('pointerenter', () => {
      btn.style.borderColor = CHAR_UI.inputFocus;
      btn.style.boxShadow = '0 0 10px rgba(231, 122, 59, 0.25)';
      btn.style.transform = 'translateY(-1px)';
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.borderColor = CHAR_UI.inputBorder;
      btn.style.boxShadow = '';
      btn.style.transform = '';
    });
    btn.addEventListener('pointerdown', () => { btn.style.transform = 'scale(0.96)'; });
    btn.addEventListener('pointerup', () => {
      if (btn.matches(':hover')) btn.style.transform = 'translateY(-1px)';
      else btn.style.transform = '';
    });
    return btn;
  }

  const randomNameBtn = makeMiniBtn('Reroll', 'Pick a random character name');
  randomNameBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    nameInput.value = pickRandomCharacterName();
    nameInput.focus();
    nameInput.select();
  });
  nameHeader.appendChild(nameLabel);
  nameHeader.appendChild(randomNameBtn);

  const nameRemembered = document.createElement('div');
  nameRemembered.textContent = savedName ? 'Saved name' : 'Random name';
  Object.assign(nameRemembered.style, {
    fontSize: '11px', color: CHAR_UI.textLow, fontStyle: 'italic',
    marginBottom: '4px', textAlign: 'left',
  });

  nameCol.appendChild(nameHeader);
  nameCol.appendChild(nameInput);
  nameCol.appendChild(nameRemembered);

  // seed column
  const seedCol = document.createElement('div');
  Object.assign(seedCol.style, { width: '140px', flexShrink: '0' });

  const seedHeader = document.createElement('div');
  Object.assign(seedHeader.style, {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    marginBottom: '4px',
  });

  const seedLabel = document.createElement('label');
  seedLabel.textContent = 'Seed';
  Object.assign(seedLabel.style, {
    display: 'block', fontSize: '13px', color: CHAR_UI.accentMuted,
    textAlign: 'left',
  });

  const seedInput = document.createElement('input');
  seedInput.type = 'text';
  seedInput.value = '0x' + (defaultSeed >>> 0).toString(16).toUpperCase();
  seedInput.maxLength = 16;
  seedInput.setAttribute('autocomplete', 'off');
  seedInput.setAttribute('spellcheck', 'false');
  Object.assign(seedInput.style, {
    display: 'block', width: '100%', boxSizing: 'border-box',
    minHeight: '44px', padding: '8px 12px',
    fontSize: '14px', fontFamily: 'monospace',
    background: CHAR_UI.inputBg, color: CHAR_UI.panelText,
    border: `1px solid ${CHAR_UI.inputBorder}`, borderRadius: '8px',
    outline: 'none',
    transition: 'border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease',
  });
  seedInput.addEventListener('focus', () => {
    seedInput.style.borderColor = CHAR_UI.inputFocus;
    seedInput.style.boxShadow = '0 0 0 2px rgba(157, 177, 199, 0.24)';
    seedInput.style.transform = 'translateY(-1px)';
  });
  seedInput.addEventListener('blur', () => {
    seedInput.style.borderColor = CHAR_UI.inputBorder;
    seedInput.style.boxShadow = '';
    seedInput.style.transform = '';
  });

  function updateSeedFieldState() {
    const raw = (seedInput.value || '').trim();
    const valid = raw.length === 0 || parseSeed(raw) != null;
    seedHint.textContent = valid ? 'Hex or number' : 'Invalid seed';
    seedHint.style.color = valid ? CHAR_UI.textLow : '#b86d57';
    if (document.activeElement !== seedInput) return;
    if (valid) {
      seedInput.style.borderColor = CHAR_UI.inputFocus;
      seedInput.style.boxShadow = '0 0 0 2px rgba(157, 177, 199, 0.24)';
    } else {
      seedInput.style.borderColor = '#8f5e4f';
      seedInput.style.boxShadow = '0 0 0 2px rgba(143, 94, 79, 0.24)';
    }
  }
  seedInput.addEventListener('input', updateSeedFieldState);

  const rerollSeedBtn = makeMiniBtn('Reroll', 'Generate a random seed');
  rerollSeedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const seed = (Math.random() * 0x100000000) >>> 0;
    seedInput.value = '0x' + seed.toString(16).toUpperCase();
    updateSeedFieldState();
  });
  seedHeader.appendChild(seedLabel);
  seedHeader.appendChild(rerollSeedBtn);

  const seedHint = document.createElement('div');
  seedHint.textContent = 'Hex or number';
  Object.assign(seedHint.style, {
    fontSize: '11px', color: CHAR_UI.textLow,
    marginTop: '3px', textAlign: 'left',
  });

  seedCol.appendChild(seedHeader);
  seedCol.appendChild(seedInput);
  seedCol.appendChild(seedHint);

  updateSeedFieldState();

  nameSeadRow.appendChild(nameCol);
  nameSeadRow.appendChild(seedCol);
  box.appendChild(nameSeadRow);

  /** Parse the seed input — accepts hex (0x...) or plain integers. Returns null if invalid. */
  function parseSeed(raw) {
    const s = (raw || '').trim();
    if (!s) return null;
    if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16) >>> 0;
    if (/^[0-9]+$/.test(s)) return parseInt(s, 10) >>> 0;
    return null;
  }

  // ---- class icon row ----
  const CLASS_ICONS = {
    druid: '🌿',
    warden: '🛡️',
    outlaw: '🗡️',
    cleric: '✨',
    archeologist: '⛏️',
    warlock: '🔮',
    gravewright: '⚰️',
    lampbearer: '🕯️',
    heretic: '☍',
    mireborn: '🐸',
  };

  const CLASS_ICON_GLOW = {
    druid: 'rgba(122, 168, 98, 0.28)',
    warden: 'rgba(116, 145, 191, 0.28)',
    outlaw: 'rgba(196, 119, 93, 0.28)',
    cleric: 'rgba(224, 205, 132, 0.26)',
    archeologist: 'rgba(195, 152, 91, 0.26)',
    warlock: 'rgba(155, 124, 198, 0.28)',
    gravewright: 'rgba(148, 136, 125, 0.24)',
    lampbearer: 'rgba(226, 164, 91, 0.28)',
    heretic: 'rgba(181, 104, 88, 0.3)',
    mireborn: 'rgba(109, 147, 95, 0.26)',
  };

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    marginBottom: '10px',
  });

  function syncClassGridCols() {
    grid.style.gridTemplateColumns = window.innerWidth <= 420
      ? 'repeat(2, minmax(0, 1fr))'
      : 'repeat(3, minmax(0, 1fr))';
  }
  syncClassGridCols();
  window.addEventListener('resize', syncClassGridCols);

  const cards = [];
  let refreshConfirmCta = () => {};
  const selectClass = (cls, card) => {
    selectedClassId = cls.id;
    for (const c of cards) {
      c.style.borderColor = CHAR_UI.cardBorder;
      c.style.background = CHAR_UI.cardBg;
      c.style.boxShadow = '';
      c.style.transform = '';
    }
    card.style.borderColor = CHAR_UI.cardSelectedBorder;
    card.style.background = CHAR_UI.cardSelectedBg;
    card.style.boxShadow = '0 0 20px rgba(144, 170, 196, 0.24), inset 0 0 0 1px rgba(204, 219, 234, 0.16)';
    card.style.transform = 'translateY(-1px)';
    detailDesc.textContent = cls.description;
    detailDeity.textContent = `${cls.deityName} (${cls.deityAlignment})`;
    detailPanel.style.opacity = '1';
    detailPanel.style.borderColor = CHAR_UI.cardSelectedBorder;
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    confirmBtn.style.cursor = 'pointer';
    refreshConfirmCta();
    try {
      detailPanel.animate(
        [
          { transform: 'translateY(2px)', opacity: 0.78 },
          { transform: 'translateY(0px)', opacity: 1 },
        ],
        { duration: 170, easing: 'ease-out' },
      );
      confirmBtn.animate(
        [
          { transform: 'scale(0.985)', filter: 'brightness(1)' },
          { transform: 'scale(1.01)', filter: 'brightness(1.12)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 180, easing: 'ease-out' },
      );
    } catch {}
  };

  for (const cls of classes) {
    const card = document.createElement('div');
    card.dataset.classId = cls.id;
    card.title = cls.name;
    Object.assign(card.style, {
      padding: '10px 4px 8px',
      background: CHAR_UI.cardBg, border: `2px solid ${CHAR_UI.cardBorder}`,
      borderRadius: '8px', cursor: 'pointer',
      textAlign: 'center', fontSize: '22px',
      transition: 'border-color 120ms, background 120ms, transform 120ms, box-shadow 120ms',
      userSelect: 'none',
      touchAction: 'manipulation',
    });

    const iconEl = document.createElement('div');
    Object.assign(iconEl.style, {
      fontSize: '23px',
      color: '#d2dfed',
      lineHeight: '1',
      marginBottom: '5px',
      filter: 'saturate(0.88) brightness(0.9)',
      textShadow: '0 0 10px rgba(148, 176, 204, 0.22)',
    });
    const icon = /** @type {any} */ (CLASS_ICONS)[cls.id];
    iconEl.textContent = icon ?? cls.name[0];
    const glow = /** @type {any} */ (CLASS_ICON_GLOW)[cls.id] || 'rgba(148, 176, 204, 0.22)';
    iconEl.style.textShadow = `0 0 10px ${glow}`;
    card.appendChild(iconEl);

    const nameEl = document.createElement('div');
    nameEl.textContent = cls.name;
    Object.assign(nameEl.style, {
      fontSize: '11px',
      color: '#b7ac9d',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      lineHeight: '1.3',
    });
    card.appendChild(nameEl);

    card.addEventListener('pointerenter', () => {
      if (selectedClassId === cls.id) return;
      card.style.borderColor = '#6a7684';
      card.style.transform = 'translateY(-1px)';
    });
    card.addEventListener('pointerleave', () => {
      if (selectedClassId === cls.id) return;
      card.style.borderColor = CHAR_UI.cardBorder;
      card.style.transform = '';
    });

    card.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectClass(cls, card);
    });

    grid.appendChild(card);
    cards.push(card);
  }
  box.appendChild(grid);

  // ---- class detail panel (shown on selection) ----
  const detailPanel = document.createElement('div');
  Object.assign(detailPanel.style, {
    minHeight: '44px', padding: '10px 12px',
    background: '#1a1714', border: `1px solid ${CHAR_UI.cardBorder}`,
    borderRadius: '8px', marginBottom: '20px',
    textAlign: 'left', opacity: '0',
    transition: 'opacity 150ms, border-color 150ms',
  });

  const detailDesc = document.createElement('div');
  Object.assign(detailDesc.style, {
    fontSize: '12px', color: '#d0c5b6', lineHeight: '1.4',
    marginBottom: '4px',
  });
  detailPanel.appendChild(detailDesc);

  const detailDeity = document.createElement('div');
  Object.assign(detailDeity.style, {
    fontSize: '11px', color: CHAR_UI.accentMuted, fontStyle: 'italic',
  });
  detailPanel.appendChild(detailDeity);

  box.appendChild(detailPanel);

  // ---- hard mode communication ----
  const hardModeRow = document.createElement('label');
  Object.assign(hardModeRow.style, {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    marginBottom: '14px',
    cursor: 'pointer',
    userSelect: 'none',
    textAlign: 'left',
    touchAction: 'manipulation',
  });

  const hardModeInput = document.createElement('input');
  hardModeInput.type = 'checkbox';
  hardModeInput.setAttribute('aria-label', 'Swear the hard vow');
  Object.assign(hardModeInput.style, {
    position: 'absolute',
    opacity: '0',
    pointerEvents: 'none',
  });

  const hardBox = document.createElement('span');
  Object.assign(hardBox.style, {
    width: '24px',
    height: '24px',
    border: '1px solid #5a6573',
    borderRadius: '6px',
    background: 'linear-gradient(180deg, #21262d, #1a1f25)',
    display: 'grid',
    placeItems: 'center',
    color: 'transparent',
    fontSize: '13px',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.35)',
    transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease, color 120ms ease, background 120ms ease',
  });
  hardBox.textContent = '✦';

  const hardCopy = document.createElement('span');
  Object.assign(hardCopy.style, {
    display: 'grid',
    gap: '2px',
  });

  const hardTitle = document.createElement('span');
  hardTitle.textContent = 'Swear the Hard Vow';
  Object.assign(hardTitle.style, {
    color: '#c2d2e1',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
  });

  const hardDesc = document.createElement('span');
  hardDesc.textContent = 'Hard mode';
  Object.assign(hardDesc.style, {
    color: CHAR_UI.textMuted,
    fontSize: '11px',
  });

  hardCopy.appendChild(hardTitle);
  hardCopy.appendChild(hardDesc);
  hardModeRow.appendChild(hardModeInput);
  hardModeRow.appendChild(hardBox);
  hardModeRow.appendChild(hardCopy);
  box.appendChild(hardModeRow);

  function renderHardModeVow() {
    if (hardModeInput.checked) {
      hardBox.style.borderColor = '#8ca2ba';
      hardBox.style.background = 'linear-gradient(180deg, rgba(127, 152, 178, 0.24), #1c2128)';
      hardBox.style.boxShadow = 'inset 0 0 0 1px rgba(127, 152, 178, 0.24), 0 0 12px rgba(127, 152, 178, 0.22)';
      hardBox.style.color = '#d3e2f1';
      hardBox.style.transform = 'translateY(-1px)';
      hardDesc.style.color = '#b7c6d6';
    } else {
      hardBox.style.borderColor = '#5a6573';
      hardBox.style.background = 'linear-gradient(180deg, #21262d, #1a1f25)';
      hardBox.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.35)';
      hardBox.style.color = 'transparent';
      hardBox.style.transform = '';
      hardDesc.style.color = CHAR_UI.textMuted;
    }
  }

  hardModeRow.addEventListener('pointerenter', () => {
    hardBox.style.borderColor = hardModeInput.checked ? '#8ca2ba' : '#798b9f';
    if (!hardModeInput.checked) hardBox.style.transform = 'translateY(-1px)';
  });
  hardModeRow.addEventListener('pointerleave', () => { renderHardModeVow(); });
  hardModeRow.addEventListener('pointerdown', () => { hardBox.style.transform = 'scale(0.97)'; });
  hardModeInput.addEventListener('change', () => {
    renderHardModeVow();
    refreshConfirmCta();
    try {
      confirmBtn.animate(
        [
          { transform: 'scale(0.985)', filter: 'brightness(1)' },
          { transform: 'scale(1.01)', filter: 'brightness(1.12)' },
          { transform: 'scale(1)', filter: 'brightness(1)' },
        ],
        { duration: 150, easing: 'ease-out' },
      );
    } catch {}
  });
  renderHardModeVow();

  // ---- confirm button ----
  const confirmRow = document.createElement('div');
  Object.assign(confirmRow.style, {
    display: 'flex',
  });

  function makeConfirmBtn() {
    const btn = document.createElement('button');
    btn.disabled = true;
    Object.assign(btn.style, {
      flex: '1',
      minHeight: '52px',
      padding: '12px',
      fontSize: '16px', fontWeight: 'bold', fontFamily: 'monospace',
      background: 'linear-gradient(180deg, #2a2f35 0%, #1f2329 100%)',
      color: '#dce5ef',
      border: '1px solid #6f7d8d',
      borderRadius: '8px',
      cursor: 'default', opacity: '0.4',
      transition: 'opacity 120ms, background 120ms, transform 120ms, box-shadow 120ms, border-color 120ms',
      touchAction: 'manipulation',
    });
    btn.textContent = 'Choose a class';
    btn.addEventListener('pointerenter', () => {
      if (btn.disabled) return;
      btn.style.transform = 'translateY(-1px)';
      btn.style.borderColor = hardModeInput.checked ? '#9cb2ca' : '#879ab0';
      btn.style.boxShadow = hardModeInput.checked
        ? '0 0 20px rgba(152, 178, 204, 0.35)'
        : '0 0 18px rgba(140, 164, 188, 0.30)';
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '';
      btn.style.borderColor = hardModeInput.checked ? '#8ca2ba' : '#6f7d8d';
    });
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (btn.disabled) return;
      btn.style.transform = 'scale(0.98)';
      const name = (nameInput.value || '').trim() || fallbackName;
      const seed = parseSeed(seedInput.value) ?? (defaultSeed >>> 0);
      const difficulty = hardModeInput.checked ? 'hard' : 'easy';
      writeSavedName(name);
      onConfirm({ name, classId: selectedClassId, seed, difficulty });
      dispose();
    });
    return btn;
  }

  const confirmBtn = makeConfirmBtn();
  let ctaPulseAnim = null;
  function setCtaPulse(enabled) {
    if (ctaPulseAnim) {
      try { ctaPulseAnim.cancel(); } catch {}
      ctaPulseAnim = null;
    }
    if (!enabled) return;
    try {
      ctaPulseAnim = confirmBtn.animate(
        [
          { boxShadow: '0 0 0 rgba(155, 181, 207, 0)', filter: 'brightness(1)' },
          { boxShadow: '0 0 20px rgba(155, 181, 207, 0.24)', filter: 'brightness(1.04)' },
        ],
        { duration: 1300, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out' },
      );
    } catch {}
  }
  refreshConfirmCta = () => {
    const className = classes.find((c) => c.id === selectedClassId)?.name || 'class';
    const hard = hardModeInput.checked;
    if (!selectedClassId) {
      confirmBtn.textContent = 'Choose a class';
      confirmBtn.style.background = 'linear-gradient(180deg, #2a2f35 0%, #1f2329 100%)';
      confirmBtn.style.color = '#dce5ef';
      confirmBtn.style.borderColor = '#6f7d8d';
      setCtaPulse(false);
      return;
    }
    confirmBtn.textContent = hard ? `Swear and descend as ${className}` : `Begin as ${className}`;
    confirmBtn.style.background = hard
      ? 'linear-gradient(180deg, #30363d 0%, #232930 100%)'
      : 'linear-gradient(180deg, #2a2f35 0%, #1f2329 100%)';
    confirmBtn.style.color = hard ? '#e8f1fb' : '#dce5ef';
    confirmBtn.style.borderColor = hard ? '#8ca2ba' : '#6f7d8d';
    setCtaPulse(true);
  };
  refreshConfirmCta();
  confirmRow.appendChild(confirmBtn);
  box.appendChild(confirmRow);

  // ---- "Did you know?" hint strip ----
  {
    let hintIndex = Math.floor(Math.random() * HINTS.length);

    const hintStrip = document.createElement('div');
    Object.assign(hintStrip.style, {
      marginTop: '20px', borderTop: `1px solid ${CHAR_UI.cardBorder}`, paddingTop: '12px',
      fontSize: '11px', color: CHAR_UI.textMuted, fontStyle: 'italic',
      textAlign: 'center', lineHeight: '1.5',
      transition: 'opacity 400ms',
      opacity: '1',
    });

    const hintIcon = document.createElement('span');
    hintIcon.textContent = '💡 ';
    Object.assign(hintIcon.style, { fontStyle: 'normal' });

    const hintText = document.createElement('span');
    hintText.textContent = HINTS[hintIndex];

    hintStrip.appendChild(hintIcon);
    hintStrip.appendChild(hintText);
    box.appendChild(hintStrip);

    hintIntervalId = setInterval(() => {
      hintStrip.style.opacity = '0';
      setTimeout(() => {
        hintIndex = (hintIndex + 1) % HINTS.length;
        hintText.textContent = HINTS[hintIndex];
        hintStrip.style.opacity = '1';
      }, 400);
    }, 7000);
  }

  // ---- global highscores ----
  {
    const hsSection = document.createElement('div');
    Object.assign(hsSection.style, {
      marginTop: '20px', borderTop: `1px solid ${CHAR_UI.cardBorder}`, paddingTop: '14px',
    });
    const hsHeading = document.createElement('div');
    hsHeading.textContent = 'Global Highscores';
    Object.assign(hsHeading.style, {
      fontSize: '11px', color: CHAR_UI.textLow, textTransform: 'uppercase',
      letterSpacing: '0.1em', marginBottom: '8px',
    });
    hsSection.appendChild(hsHeading);
    const hsList = document.createElement('div');
    hsList.textContent = 'Loading\u2026';
    Object.assign(hsList.style, { fontSize: '12px', color: CHAR_UI.textLow });
    hsSection.appendChild(hsList);
    box.appendChild(hsSection);
    getHighscores().then(scores => {
      hsList.textContent = '';
      if (!scores || scores.length === 0) return;
      const top = scores.slice(0, 5);
      for (let i = 0; i < top.length; i++) {
        const entry = top[i];
        const row = document.createElement('div');
        Object.assign(row.style, {
          display: 'flex', gap: '8px', lineHeight: '1.7',
          fontSize: '12px', fontFamily: 'monospace', color: '#b89a84',
        });
        const rankEl = document.createElement('span');
        rankEl.textContent = `#${i + 1}`;
        rankEl.style.cssText = 'width:2.2em;text-align:right;flex-shrink:0;color:#836251';
        const versionEl = document.createElement('span');
        versionEl.textContent = getHighscoreVersionLabel(entry);
        versionEl.style.cssText = 'width:5.4em;text-align:left;flex-shrink:0;color:#9e7f6a;opacity:0.9';
        const nameEl = document.createElement('span');
        nameEl.textContent = entry.playerName || '???';
        nameEl.style.cssText = 'flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const scoreEl = document.createElement('span');
        scoreEl.textContent = String(entry.score ?? 0);
        scoreEl.style.cssText = 'text-align:right;flex-shrink:0;color:#d8a06d';
        const clsEl = document.createElement('span');
        clsEl.textContent = entry.className || '';
        clsEl.style.cssText = 'width:5.5em;text-align:left;flex-shrink:0;color:#9d7f6d;opacity:0.8';
        row.appendChild(rankEl);
        row.appendChild(versionEl);
        row.appendChild(nameEl);
        row.appendChild(scoreEl);
        row.appendChild(clsEl);
        hsList.appendChild(row);
      }
    }).catch(() => { hsList.textContent = ''; });
  }

  panel.appendChild(bgCanvas);
  panel.appendChild(box);
  document.body.appendChild(panel);
  try {
    box.animate(
      [
        { opacity: 0, transform: 'translateY(8px) scale(0.992)' },
        { opacity: 1, transform: 'translateY(0px) scale(1)' },
      ],
      { duration: 220, easing: 'cubic-bezier(0.22, 0.9, 0.3, 1)', fill: 'both' },
    );
  } catch {}

  // Select the name text on show so the player can immediately type
  nameInput.select();

  // Enter key confirms if ready
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !confirmBtn.disabled) {
      e.preventDefault();
      const name = (nameInput.value || '').trim() || fallbackName;
      const seed = parseSeed(seedInput.value) ?? (defaultSeed >>> 0);
      const difficulty = hardModeInput.checked ? 'hard' : 'easy';
      writeSavedName(name);
      onConfirm({ name, classId: selectedClassId, seed, difficulty });
      dispose();
    }
  });

  function dispose() {
    if (bgRafId !== null) cancelAnimationFrame(bgRafId);
    if (hintIntervalId !== null) clearInterval(hintIntervalId);
    if (ctaPulseAnim) {
      try { ctaPulseAnim.cancel(); } catch {}
      ctaPulseAnim = null;
    }
    window.removeEventListener('resize', resizeBgCanvas);
    window.removeEventListener('resize', syncClassGridCols);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }

  return { dispose };
}
