// display/ui/statusLine.js
// NetHack-style horizontal status line (bottom of screen, above action bar).

export function initStatusLine() {
  let root = document.getElementById('ui-root');
  if (!root) return;

  const line = document.createElement('div');
  Object.assign(line.style, {
    position: 'fixed',
    left: '8px', right: '8px', bottom: '48px',
    textAlign: 'center',
    fontFamily: 'monospace',
    fontSize: 'min(12px, 3vw)',
    color: '#cfd3dc',
    opacity: '0.85',
    pointerEvents: 'none',
    zIndex: '900',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  });
  root.appendChild(line);

  let depth = 1, hp = 0, maxHp = 1, mana = 0, maxMana = 1, atk = 0, def = 0;

  function render() {
    const fmt = (v) => v > 0 ? `+${v}` : `${v}`;
    line.textContent =
      `DLvl:${depth} \u2022 HP:${hp}/${maxHp} \u2022 Mana:${mana}/${maxMana} \u2022 Atk:${fmt(atk)} \u2022 Def:${fmt(def)}`;
  }

  window.addEventListener('ui:updateDepth', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    depth = Number(e?.detail?.depth ?? depth);
    render();
  });

  window.addEventListener('ui:updateVitals', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    hp = Number(e?.detail?.hp ?? 0);
    maxHp = Math.max(1, Number(e?.detail?.maxHp ?? 1));
    mana = Number(e?.detail?.mana ?? 0);
    maxMana = Math.max(1, Number(e?.detail?.maxMana ?? 1));
    render();
  });

  window.addEventListener('ui:updateCombatHUD', (ev) => {
    /** @type {CustomEvent} */ // @ts-ignore
    const e = ev;
    const weapon = e?.detail?.weapon;
    atk = Number(weapon?.attack ?? 0);
    def = Number(e?.detail?.defense ?? 0);
    render();
  });

  render();
}
