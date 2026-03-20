// display/ui/charCreation.js
// Character creation screen. Pure presentation — no rules/ imports (shared/ is OK).
// Data is passed in by main.js via showCharCreation(opts).
import { versionLoaded, getVersionState } from '../../shared/version.js';
import { pickRandomCharacterName } from '../../shared/utils/characterNames.js';
import { getHighscores } from '../../shared/tombstoneApi.js';
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

  // ---- name + seed row ----
  const nameSeadRow = document.createElement('div');
  Object.assign(nameSeadRow.style, {
    display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end',
  });

  // name column
  const nameCol = document.createElement('div');
  Object.assign(nameCol.style, { flex: '1', minWidth: '0' });

  const nameLabel = document.createElement('label');
  nameLabel.textContent = 'Name';
  Object.assign(nameLabel.style, {
    display: 'block', fontSize: '13px', color: '#6a8ab0',
    marginBottom: '4px', textAlign: 'left',
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
    background: '#111827', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px',
    outline: 'none',
  });
  nameInput.addEventListener('focus', () => { nameInput.style.borderColor = '#4a6a9a'; });
  nameInput.addEventListener('blur', () => { nameInput.style.borderColor = '#2d3b52'; });

  const nameRemembered = document.createElement('div');
  nameRemembered.textContent = 'saved name';
  Object.assign(nameRemembered.style, {
    fontSize: '11px', color: '#4a6080', fontStyle: 'italic',
    marginBottom: '4px', textAlign: 'left',
  });

  nameCol.appendChild(nameLabel);
  nameCol.appendChild(nameInput);
  nameCol.appendChild(nameRemembered);

  // seed column
  const seedCol = document.createElement('div');
  Object.assign(seedCol.style, { width: '140px', flexShrink: '0' });

  const seedLabel = document.createElement('label');
  seedLabel.textContent = 'Seed';
  Object.assign(seedLabel.style, {
    display: 'block', fontSize: '13px', color: '#6a8ab0',
    marginBottom: '4px', textAlign: 'left',
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
    background: '#111827', color: '#cfe8ff',
    border: '1px solid #2d3b52', borderRadius: '6px',
    outline: 'none',
  });
  seedInput.addEventListener('focus', () => { seedInput.style.borderColor = '#4a6a9a'; });
  seedInput.addEventListener('blur', () => { seedInput.style.borderColor = '#2d3b52'; });

  const seedHint = document.createElement('div');
  seedHint.textContent = 'Hex or number';
  Object.assign(seedHint.style, {
    fontSize: '11px', color: '#4a6080',
    marginTop: '3px', textAlign: 'left',
  });

  seedCol.appendChild(seedLabel);
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
  const CLASS_ICONS = { druid: '🌿', warden: '🛡️', outlaw: '🗡️', cleric: '✨', archeologist: '⛏️', warlock: '🔮' };

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'flex', justifyContent: 'space-between',
    gap: '8px', marginBottom: '10px',
  });

  const cards = [];
  for (const cls of classes) {
    const card = document.createElement('div');
    card.dataset.classId = cls.id;
    card.title = cls.name;
    Object.assign(card.style, {
      flex: '1',
      padding: '10px 4px',
      background: '#111827', border: '2px solid #1e2a3e',
      borderRadius: '8px', cursor: 'pointer',
      textAlign: 'center', fontSize: '22px',
      transition: 'border-color 120ms, background 120ms',
      userSelect: 'none',
    });

    const icon = /** @type {any} */ (CLASS_ICONS)[cls.id];
    card.textContent = icon ?? cls.name[0];

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
      confirmBtn.textContent = `Begin as a ${cls.name}`;
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
  confirmBtn.textContent = 'Choose a class';
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
    writeSavedName(name);
    onConfirm({ name, classId: selectedClassId, seed });
    dispose();
  });
  box.appendChild(confirmBtn);

  // ---- "Did you know?" hint strip ----
  {
    let hintIndex = Math.floor(Math.random() * HINTS.length);

    const hintStrip = document.createElement('div');
    Object.assign(hintStrip.style, {
      marginTop: '20px', borderTop: '1px solid #1e2a3e', paddingTop: '12px',
      fontSize: '11px', color: '#5a7a9a', fontStyle: 'italic',
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
      marginTop: '20px', borderTop: '1px solid #1e2a3e', paddingTop: '14px',
    });
    const hsHeading = document.createElement('div');
    hsHeading.textContent = 'Global Highscores';
    Object.assign(hsHeading.style, {
      fontSize: '11px', color: '#3a5070', textTransform: 'uppercase',
      letterSpacing: '0.1em', marginBottom: '8px',
    });
    hsSection.appendChild(hsHeading);
    const hsList = document.createElement('div');
    hsList.textContent = 'Loading\u2026';
    Object.assign(hsList.style, { fontSize: '12px', color: '#3a5070' });
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
          fontSize: '12px', fontFamily: 'monospace', color: '#7a9ab0',
        });
        const rankEl = document.createElement('span');
        rankEl.textContent = `#${i + 1}`;
        rankEl.style.cssText = 'width:2.2em;text-align:right;flex-shrink:0;color:#3a5878';
        const nameEl = document.createElement('span');
        nameEl.textContent = entry.playerName || '???';
        nameEl.style.cssText = 'flex:1;text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        const scoreEl = document.createElement('span');
        scoreEl.textContent = String(entry.score ?? 0);
        scoreEl.style.cssText = 'text-align:right;flex-shrink:0;color:#90c89a';
        const clsEl = document.createElement('span');
        clsEl.textContent = entry.className || '';
        clsEl.style.cssText = 'width:5.5em;text-align:left;flex-shrink:0;color:#7090b0;opacity:0.8';
        row.appendChild(rankEl);
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
      onConfirm({ name, classId: selectedClassId, seed });
      dispose();
    }
  });

  function dispose() {
    if (bgRafId !== null) cancelAnimationFrame(bgRafId);
    if (hintIntervalId !== null) clearInterval(hintIntervalId);
    window.removeEventListener('resize', resizeBgCanvas);
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }

  return { dispose };
}
