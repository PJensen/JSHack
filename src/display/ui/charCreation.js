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
  panelBg: 'rgba(6, 4, 4, 0.965)',
  panelText: '#d8c8b4',
  boxBg: '#0d0908',
  boxBorder: '#3b2a22',
  boxGlow: 'rgba(255, 102, 38, 0.18)',
  cardBg: '#140f0d',
  cardBorder: '#2e211b',
  cardSelectedBg: '#1f1310',
  cardSelectedBorder: '#a64c2b',
  inputBg: '#130f0d',
  inputBorder: '#3a2b24',
  inputFocus: '#b56239',
  accent: '#e98a53',
  accentMuted: '#9d765f',
  textMuted: '#826a5a',
  textLow: '#5f4d43',
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
      radial-gradient(1200px 700px at 50% -10%, rgba(110, 36, 16, 0.30), transparent 60%),
      radial-gradient(1000px 700px at 50% 120%, rgba(30, 14, 10, 0.7), transparent 70%),
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
    background: CHAR_UI.boxBg,
    border: `1px solid ${CHAR_UI.boxBorder}`,
    borderRadius: '12px',
    padding: '24px 20px',
    boxShadow: `
      0 28px 80px rgba(0, 0, 0, 0.7),
      0 0 40px ${CHAR_UI.boxGlow},
      inset 0 0 0 1px rgba(255, 160, 100, 0.05),
      inset 0 -30px 60px rgba(255, 98, 28, 0.05)
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

  for (let i = 0; i < 64; i++) {
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
    baseGrad.addColorStop(0, 'rgba(10, 7, 7, 0.35)');
    baseGrad.addColorStop(0.45, 'rgba(22, 11, 9, 0.18)');
    baseGrad.addColorStop(1, 'rgba(33, 14, 10, 0.35)');
    bgCtx.fillStyle = baseGrad;
    bgCtx.fillRect(0, 0, w, h);

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
      glow.addColorStop(0, `rgba(255, 248, 200, ${alpha * 0.95})`);
      glow.addColorStop(0.2, `rgba(255, 158, 74, ${alpha * 0.9})`);
      glow.addColorStop(0.58, `rgba(255, 91, 28, ${alpha * 0.4})`);
      glow.addColorStop(1, 'rgba(255, 60, 18, 0)');
      bgCtx.fillStyle = glow;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, size * 6, 0, Math.PI * 2);
      bgCtx.fill();
    }

    const vignette = bgCtx.createRadialGradient(
      w * 0.5,
      h * 0.45,
      Math.min(w, h) * 0.1,
      w * 0.5,
      h * 0.45,
      Math.max(w, h) * 0.68,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(0.8, 'rgba(0,0,0,0.35)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.65)');
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
    color: '#f0b38a',
    textTransform: 'uppercase',
    textShadow: '0 0 18px rgba(255, 115, 44, 0.25)',
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
    background: '#15100e',
    color: CHAR_UI.accent,
    fontSize: '16px', textDecoration: 'none',
    lineHeight: '1',
    transition: 'transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease',
  });
  helpLink.addEventListener('pointerenter', () => {
    helpLink.style.transform = 'translateY(-1px)';
    helpLink.style.borderColor = CHAR_UI.inputFocus;
    helpLink.style.boxShadow = '0 0 16px rgba(242, 118, 59, 0.28)';
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
    nameInput.style.boxShadow = '0 0 0 2px rgba(240, 140, 84, 0.18)';
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
    seedInput.style.boxShadow = '0 0 0 2px rgba(240, 140, 84, 0.18)';
    seedInput.style.transform = 'translateY(-1px)';
  });
  seedInput.addEventListener('blur', () => {
    seedInput.style.borderColor = CHAR_UI.inputBorder;
    seedInput.style.boxShadow = '';
    seedInput.style.transform = '';
  });

  const rerollSeedBtn = makeMiniBtn('Reroll', 'Generate a random seed');
  rerollSeedBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    const seed = (Math.random() * 0x100000000) >>> 0;
    seedInput.value = '0x' + seed.toString(16).toUpperCase();
    seedInput.focus();
    seedInput.select();
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
    card.style.boxShadow = '0 0 20px rgba(246, 120, 58, 0.25), inset 0 0 0 1px rgba(255, 158, 108, 0.14)';
    card.style.transform = 'translateY(-1px)';
    detailDesc.textContent = cls.description;
    detailDeity.textContent = `${cls.deityName} (${cls.deityAlignment})`;
    detailPanel.style.opacity = '1';
    detailPanel.style.borderColor = CHAR_UI.cardSelectedBorder;
    confirmBtn.disabled = false;
    confirmBtn.style.opacity = '1';
    confirmBtn.style.cursor = 'pointer';
    refreshConfirmCta();
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
      color: '#efab84',
      lineHeight: '1',
      marginBottom: '5px',
      filter: 'saturate(0.88) brightness(0.9)',
      textShadow: '0 0 10px rgba(243, 124, 59, 0.18)',
    });
    const icon = /** @type {any} */ (CLASS_ICONS)[cls.id];
    iconEl.textContent = icon ?? cls.name[0];
    const glow = /** @type {any} */ (CLASS_ICON_GLOW)[cls.id] || 'rgba(243, 124, 59, 0.18)';
    iconEl.style.textShadow = `0 0 10px ${glow}`;
    card.appendChild(iconEl);

    const nameEl = document.createElement('div');
    nameEl.textContent = cls.name;
    Object.assign(nameEl.style, {
      fontSize: '11px',
      color: '#b8967f',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      lineHeight: '1.3',
    });
    card.appendChild(nameEl);

    card.addEventListener('pointerenter', () => {
      if (selectedClassId === cls.id) return;
      card.style.borderColor = '#4a3026';
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
    background: '#150f0e', border: `1px solid ${CHAR_UI.cardBorder}`,
    borderRadius: '8px', marginBottom: '20px',
    textAlign: 'left', opacity: '0',
    transition: 'opacity 150ms, border-color 150ms',
  });

  const detailDesc = document.createElement('div');
  Object.assign(detailDesc.style, {
    fontSize: '12px', color: '#b39c8f', lineHeight: '1.4',
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
    border: '1px solid #5a3026',
    borderRadius: '6px',
    background: 'linear-gradient(180deg, #1a110e, #130c0a)',
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
    color: '#be7a67',
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
      hardBox.style.borderColor = '#8e4732';
      hardBox.style.background = 'linear-gradient(180deg, rgba(122, 61, 52, 0.24), #1a0f0c)';
      hardBox.style.boxShadow = 'inset 0 0 0 1px rgba(122, 61, 52, 0.22), 0 0 12px rgba(122, 61, 52, 0.22)';
      hardBox.style.color = '#cb8773';
      hardBox.style.transform = 'translateY(-1px)';
      hardDesc.style.color = '#be7a67';
    } else {
      hardBox.style.borderColor = '#5a3026';
      hardBox.style.background = 'linear-gradient(180deg, #1a110e, #130c0a)';
      hardBox.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.03), inset 0 -1px 0 rgba(0,0,0,0.35)';
      hardBox.style.color = 'transparent';
      hardBox.style.transform = '';
      hardDesc.style.color = CHAR_UI.textMuted;
    }
  }

  hardModeRow.addEventListener('pointerenter', () => {
    hardBox.style.borderColor = hardModeInput.checked ? '#8e4732' : '#7b4030';
    if (!hardModeInput.checked) hardBox.style.transform = 'translateY(-1px)';
  });
  hardModeRow.addEventListener('pointerleave', () => { renderHardModeVow(); });
  hardModeRow.addEventListener('pointerdown', () => { hardBox.style.transform = 'scale(0.97)'; });
  hardModeInput.addEventListener('change', () => {
    renderHardModeVow();
    refreshConfirmCta();
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
      background: 'linear-gradient(180deg, #2a1712 0%, #1e0f0c 100%)',
      color: '#efb08e',
      border: '1px solid #6a402d',
      borderRadius: '8px',
      cursor: 'default', opacity: '0.4',
      transition: 'opacity 120ms, background 120ms, transform 120ms, box-shadow 120ms, border-color 120ms',
      touchAction: 'manipulation',
    });
    btn.textContent = 'Choose a class';
    btn.addEventListener('pointerenter', () => {
      if (btn.disabled) return;
      btn.style.transform = 'translateY(-1px)';
      btn.style.borderColor = hardModeInput.checked ? '#b04a2c' : '#a05d41';
      btn.style.boxShadow = hardModeInput.checked
        ? '0 0 20px rgba(245, 90, 36, 0.35)'
        : '0 0 18px rgba(231, 128, 74, 0.28)';
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transform = '';
      btn.style.boxShadow = '';
      btn.style.borderColor = hardModeInput.checked ? '#7a3725' : '#6a402d';
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
  refreshConfirmCta = () => {
    const className = classes.find((c) => c.id === selectedClassId)?.name || 'class';
    const hard = hardModeInput.checked;
    if (!selectedClassId) {
      confirmBtn.textContent = 'Choose a class';
      confirmBtn.style.background = 'linear-gradient(180deg, #2a1712 0%, #1e0f0c 100%)';
      confirmBtn.style.color = '#efb08e';
      confirmBtn.style.borderColor = '#6a402d';
      return;
    }
    confirmBtn.textContent = hard ? `Swear and descend as ${className}` : `Begin as ${className}`;
    confirmBtn.style.background = hard
      ? 'linear-gradient(180deg, #25120f 0%, #1b0d0b 100%)'
      : 'linear-gradient(180deg, #2a1712 0%, #1e0f0c 100%)';
    confirmBtn.style.color = hard ? '#ff9468' : '#efb08e';
    confirmBtn.style.borderColor = hard ? '#7a3725' : '#6a402d';
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

  // Select the name text on show so the player can immediately type
  nameInput.select();

  // Enter key confirms if ready
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !confirmBtn.disabled) {
      e.preventDefault();
      const name = (nameInput.value || '').trim() || fallbackName;
      const seed = parseSeed(seedInput.value) ?? (defaultSeed >>> 0);
      writeSavedName(name);
      onConfirm({ name, classId: selectedClassId, seed, difficulty: 'easy' });
      dispose();
    }
  });

  function dispose() {
    if (bgRafId !== null) cancelAnimationFrame(bgRafId);
    if (hintIntervalId !== null) clearInterval(hintIntervalId);
    window.removeEventListener('resize', resizeBgCanvas);
    window.removeEventListener('resize', syncClassGridCols);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }

  return { dispose };
}
