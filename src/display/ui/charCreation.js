// display/ui/charCreation.js
// Character creation screen. Pure presentation — no rules/ imports (shared/ is OK).
// Data is passed in by main.js via showCharCreation(opts).
import { versionLoaded } from '../../shared/version.js';

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

  // ---- version ----
  const versionEl = document.createElement('div');
  Object.assign(versionEl.style, {
    fontSize: '12px', color: '#4a6080',
    marginBottom: '10px',
  });
  box.appendChild(versionEl);
  versionLoaded.then(() => {
    const ver = /** @type {any} */ (window).VERSION;
    if (ver) versionEl.textContent = `v${ver}`;
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
  nameInput.value = 'Hero';
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

  // ---- class grid (2x2) ----
  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginBottom: '20px',
  });

  const cards = [];
  for (const cls of classes) {
    const card = document.createElement('div');
    card.dataset.classId = cls.id;
    Object.assign(card.style, {
      minHeight: '88px', padding: '12px 10px',
      background: '#111827', border: '2px solid #1e2a3e',
      borderRadius: '8px', cursor: 'pointer',
      textAlign: 'left',
      transition: 'border-color 120ms, background 120ms',
    });

    const cName = document.createElement('div');
    cName.textContent = cls.name;
    Object.assign(cName.style, {
      fontSize: '16px', fontWeight: 'bold', color: '#cfe8ff',
      marginBottom: '4px',
    });
    card.appendChild(cName);

    const cDesc = document.createElement('div');
    cDesc.textContent = cls.description;
    Object.assign(cDesc.style, {
      fontSize: '11px', color: '#8a9ab0', lineHeight: '1.4',
      marginBottom: '6px',
    });
    card.appendChild(cDesc);

    const cDeity = document.createElement('div');
    cDeity.textContent = `${cls.deityName} (${cls.deityAlignment})`;
    Object.assign(cDeity.style, {
      fontSize: '11px', color: '#5a7a9a', fontStyle: 'italic',
    });
    card.appendChild(cDeity);

    card.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      selectedClassId = cls.id;
      for (const c of cards) {
        c.style.borderColor = '#1e2a3e';
        c.style.background = '#111827';
      }
      card.style.borderColor = '#4a8aff';
      card.style.background = '#141e30';
      confirmBtn.disabled = false;
      confirmBtn.style.opacity = '1';
      confirmBtn.style.cursor = 'pointer';
    });

    grid.appendChild(card);
    cards.push(card);
  }
  box.appendChild(grid);

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
    const name = (nameInput.value || '').trim() || 'Hero';
    const seed = parseSeed(seedInput.value) ?? (defaultSeed >>> 0);
    onConfirm({ name, classId: selectedClassId, seed });
    dispose();
  });
  box.appendChild(confirmBtn);

  panel.appendChild(box);
  document.body.appendChild(panel);

  // Select the name text on show so the player can immediately type
  nameInput.select();

  // Enter key confirms if ready
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !confirmBtn.disabled) {
      e.preventDefault();
      const name = (nameInput.value || '').trim() || 'Hero';
      const seed = parseSeed(seedInput.value) ?? (defaultSeed >>> 0);
      onConfirm({ name, classId: selectedClassId, seed });
      dispose();
    }
  });

  function dispose() {
    if (panel.parentNode) panel.parentNode.removeChild(panel);
  }

  return { dispose };
}
