// display/ui/charCreation.js
// Character creation screen. Pure presentation — no rules/ imports (shared/ is OK).
// Data is passed in by main.js via showCharCreation(opts).
import { versionLoaded, getVersionState } from '../../shared/version.js';
import { pickRandomCharacterName } from '../../shared/utils/characterNames.js';

/**
 * @param {{
 *   classes: Array<{ id: string, name: string, description: string, deityName: string, deityAlignment: string }>,
 *   defaultSeed?: number,
 *   onConfirm: (result: { name: string, classId: string, seed: number }) => void,
 * }} opts
 * @returns {{ dispose: () => void }}
 */
export function showCharCreation({ classes, defaultSeed = 0xC0FFEE, onConfirm }) {
  let selectedClassId = null;
  const fallbackName = pickRandomCharacterName();

  // ---- backdrop (full-viewport, blocks all input) ----
  const panel = document.createElement('div');
  panel.id = 'char-creation';
  Object.assign(panel.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    pointerEvents: 'auto',
    background: 'rgba(6,9,14,0.97)',
    fontFamily: 'monospace', zIndex: '1400',
    color: '#cfe8ff',
  });

  // ---- inner box ----
  const box = document.createElement('div');
  Object.assign(box.style, {
    width: 'min(460px, 90vw)',
    maxHeight: '92vh', overflowY: 'auto',
    textAlign: 'center',
    background: '#0b0e16', border: '1px solid #2d3b52', borderRadius: '10px',
    padding: '24px 20px', boxShadow: '0 0 60px rgba(40,80,160,0.25)',
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

  function resizeBgCanvas() {
    bgCanvas.width = window.innerWidth;
    bgCanvas.height = window.innerHeight;
  }
  resizeBgCanvas();
  window.addEventListener('resize', resizeBgCanvas);

  const BG_PART_COLORS = [
    [50, 90, 200], [70, 50, 170], [30, 150, 190], [90, 70, 210], [50, 130, 245],
  ];

  const bgParts = [];
  for (let i = 0; i < 18; i++) {
    const nc = BG_PART_COLORS[Math.floor(Math.random() * BG_PART_COLORS.length)];
    bgParts.push({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vy: -(0.12 + Math.random() * 0.22),
      sway: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
      radius: 28 + Math.random() * 65,
      alpha: 0.14 + Math.random() * 0.14,
      r: nc[0], g: nc[1], b: nc[2],
    });
  }

  function bgLoop() {
    bgRafId = requestAnimationFrame(bgLoop);
    const w = bgCanvas.width, h = bgCanvas.height;
    bgCtx.clearRect(0, 0, w, h);
    for (const p of bgParts) {
      p.phase += 0.012;
      p.x += p.sway + Math.sin(p.phase) * 0.3;
      p.y += p.vy;
      if (p.y + p.radius < 0) {
        p.y = h + p.radius;
        p.x = Math.random() * w;
        const nc = BG_PART_COLORS[Math.floor(Math.random() * BG_PART_COLORS.length)];
        p.r = nc[0]; p.g = nc[1]; p.b = nc[2];
        p.radius = 28 + Math.random() * 65;
        p.alpha = 0.14 + Math.random() * 0.14;
      }
      const grad = bgCtx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
      grad.addColorStop(0, `rgba(${p.r},${p.g},${p.b},${p.alpha})`);
      grad.addColorStop(1, `rgba(${p.r},${p.g},${p.b},0)`);
      bgCtx.fillStyle = grad;
      bgCtx.beginPath();
      bgCtx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      bgCtx.fill();
    }
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
    fontSize: '22px', fontWeight: 'bold', color: '#7ab8ff',
    textShadow: '0 0 12px rgba(80,140,255,0.3)',
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
    border: '1px solid #2d3b52', background: '#101626', color: '#7ab8ff',
    fontSize: '16px', textDecoration: 'none',
    lineHeight: '1',
  });

  titleRow.appendChild(title);
  titleRow.appendChild(helpLink);
  box.appendChild(titleRow);

  // ---- version + subscribe row ----
  const versionRow = document.createElement('div');
  Object.assign(versionRow.style, {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: '10px', marginBottom: '10px',
  });

  const versionEl = document.createElement('div');
  Object.assign(versionEl.style, {
    fontSize: '12px', color: '#4a6080',
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
    fontSize: '12px', color: '#7aacdf',
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
      color: '#b9ffd2',
      background: 'rgba(44,94,58,0.42)',
      border: '1px solid #4e9a61',
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
  musicNudge.textContent = '\u266B Best played with your own music';
  Object.assign(musicNudge.style, {
    fontSize: '11px', color: '#4a6080', fontStyle: 'italic',
    marginBottom: '20px',
  });
  box.appendChild(musicNudge);

  // ---- name input ----
  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  Object.assign(nameLabel.style, {
    display: 'block', fontSize: '13px', color: '#6a8ab0',
    marginBottom: '4px', textAlign: 'left',
  });
  box.appendChild(nameLabel);

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
    background: '#111827', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px',
    outline: 'none', marginBottom: '20px',
  });
  nameInput.addEventListener('focus', () => { nameInput.style.borderColor = '#4a6a9a'; });
  nameInput.addEventListener('blur', () => { nameInput.style.borderColor = '#2d3b52'; });
  box.appendChild(nameInput);

  // ---- seed input ----
  const seedLabel = document.createElement('label');
  seedLabel.textContent = 'Seed';
  Object.assign(seedLabel.style, {
    display: 'block', fontSize: '13px', color: '#6a8ab0',
    marginBottom: '4px', textAlign: 'left',
  });
  box.appendChild(seedLabel);

  const seedInput = document.createElement('input');
  seedInput.type = 'text';
  seedInput.value = '0x' + (defaultSeed >>> 0).toString(16).toUpperCase();
  seedInput.maxLength = 16;
  seedInput.setAttribute('autocomplete', 'off');
  seedInput.setAttribute('spellcheck', 'false');
  Object.assign(seedInput.style, {
    display: 'block', width: '100%', boxSizing: 'border-box',
    minHeight: '44px', padding: '8px 12px',
    fontSize: '18px', fontFamily: 'monospace',
    background: '#111827', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px',
    outline: 'none', marginBottom: '4px',
  });
  seedInput.addEventListener('focus', () => { seedInput.style.borderColor = '#4a6a9a'; });
  seedInput.addEventListener('blur', () => { seedInput.style.borderColor = '#2d3b52'; });
  box.appendChild(seedInput);

  const seedHint = document.createElement('div');
  seedHint.textContent = 'Hex or number';
  Object.assign(seedHint.style, {
    fontSize: '11px', color: '#4a6080',
    marginBottom: '20px', textAlign: 'left',
  });
  box.appendChild(seedHint);

  /** Parse the seed input — accepts hex (0x...) or plain integers. Returns null if invalid. */
  function parseSeed(raw) {
    const s = (raw || '').trim();
    if (!s) return null;
    if (/^0x[0-9a-f]+$/i.test(s)) return parseInt(s, 16) >>> 0;
    if (/^[0-9]+$/.test(s)) return parseInt(s, 10) >>> 0;
    return null;
  }

  // ---- class section ----
  const classLabel = document.createElement('div');
  classLabel.textContent = 'Choose your path';
  Object.assign(classLabel.style, {
    fontSize: '13px', color: '#6a8ab0',
    marginBottom: '10px', textAlign: 'left',
  });
  box.appendChild(classLabel);

  // ---- class grid (2x3) ----
  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginBottom: '10px',
  });

  const CLASS_ICONS = { druid: '🌿', warden: '🛡️', outlaw: '🗡️', cleric: '✨', archeologist: '⛏️', warlock: '🔮' };

  const cards = [];
  for (const cls of classes) {
    const card = document.createElement('div');
    card.dataset.classId = cls.id;
    Object.assign(card.style, {
      padding: '10px 10px',
      background: '#111827', border: '2px solid #1e2a3e',
      borderRadius: '8px', cursor: 'pointer',
      textAlign: 'center',
      transition: 'border-color 120ms, background 120ms',
    });

    const cName = document.createElement('div');
    const icon = /** @type {any} */ (CLASS_ICONS)[cls.id];
    cName.textContent = icon ? `${icon} ${cls.name}` : cls.name;
    Object.assign(cName.style, {
      fontSize: '14px', fontWeight: 'bold', color: '#cfe8ff',
    });
    card.appendChild(cName);

    card.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectedClassId = cls.id;
      for (const c of cards) {
        c.style.borderColor = '#1e2a3e';
        c.style.background = '#111827';
      }
      card.style.borderColor = '#4a8aff';
      card.style.background = '#141e30';
      detailDesc.textContent = cls.description;
      detailDeity.textContent = `${cls.deityName} (${cls.deityAlignment})`;
      detailPanel.style.opacity = '1';
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
    });

    grid.appendChild(card);
    cards.push(card);
  }
  box.appendChild(grid);

  // ---- class detail panel (shown on selection) ----
  const detailPanel = document.createElement('div');
  Object.assign(detailPanel.style, {
    minHeight: '44px', padding: '10px 12px',
    background: '#111827', border: '1px solid #1e2a3e',
    borderRadius: '8px', marginBottom: '20px',
    textAlign: 'left', opacity: '0',
    transition: 'opacity 150ms',
  });

  const detailDesc = document.createElement('div');
  Object.assign(detailDesc.style, {
    fontSize: '12px', color: '#8a9ab0', lineHeight: '1.4',
    marginBottom: '4px',
  });
  detailPanel.appendChild(detailDesc);

  const detailDeity = document.createElement('div');
  Object.assign(detailDeity.style, {
    fontSize: '11px', color: '#5a7a9a', fontStyle: 'italic',
  });
  detailPanel.appendChild(detailDeity);

  box.appendChild(detailPanel);

  // ---- confirm button ----
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = 'Begin';
  confirmBtn.disabled = true;
  Object.assign(confirmBtn.style, {
    display: 'block', width: '100%',
    minHeight: '52px', padding: '12px',
    fontSize: '18px', fontWeight: 'bold', fontFamily: 'monospace',
    background: '#1a2a44', color: '#7ab8ff',
    border: '1px solid #4a6a9a', borderRadius: '8px',
    cursor: 'default', opacity: '0.4',
    transition: 'opacity 120ms, background 120ms',
  });
  confirmBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    if (confirmBtn.disabled) return;
    const name = (nameInput.value || '').trim() || fallbackName;
    const seed = parseSeed(seedInput.value) ?? (defaultSeed >>> 0);
    onConfirm({ name, classId: selectedClassId, seed });
    dispose();
  });
  box.appendChild(confirmBtn);

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
      onConfirm({ name, classId: selectedClassId, seed });
      dispose();
    }
  });

  function dispose() {
    if (bgRafId !== null) cancelAnimationFrame(bgRafId);
    window.removeEventListener('resize', resizeBgCanvas);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }

  return { dispose };
}
