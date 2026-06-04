import {
  decorateButton, sanitize, bracketize,
  UI, hide, showItemTooltip, hideItemTooltip, rarityStyle,
  getUiItemEntityIds, createChooserRow, createSimpleSel,
  installKeyHandler, installDetachableKeyHandler, pulseRow,
} from './overlayUtils.js';

export function renderShop(panel, data, state) {
  const prevDetach = /** @type {any} */ (panel)._shopDetach;
  if (typeof prevDetach === 'function') { try { prevDetach(); } catch (_) {} }
  /** @type {any} */ (panel)._shopDetach = null;

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  const mode = data?.mode || state?.mode || 'browse';
  const vendorKind = String(data?.vendorKind || state?.vendorKind || '');
  const shopItems = data?.shopItems || [];
  const playerItems = data?.playerItems || [];
  const appraisableItems = data?.appraisableItems || [];
  const unpaidItems = data?.unpaidItems || [];
  const totalBill = data?.totalBill || 0;
  const gold = data?.gold || 0;
  const shopkeeperId = Number(data?.shopkeeperId || state?.shopkeeperId || 0) | 0;

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' });
  const titleWrap = document.createElement('div');
  Object.assign(titleWrap.style, { display: 'flex', flexDirection: 'column', gap: '2px' });
  const title = document.createElement('div');
  title.textContent = mode === 'checkout'
    ? (vendorKind === 'gem' ? 'Gem Dealer Invoice' : vendorKind === 'book' ? 'Bookseller Invoice' : 'Shopkeeper Invoice')
    : (vendorKind === 'gem' ? 'Gem Dealer' : vendorKind === 'book' ? 'Bookseller' : 'Shopkeeper');
  title.style.fontWeight = 'bold'; title.style.fontSize = '16px';
  titleWrap.appendChild(title);
  if (mode !== 'checkout' && vendorKind === 'gem') {
    const subtitle = document.createElement('div');
    subtitle.textContent = 'All stones on display are identified. Socketable gems list their effects in the tooltip.';
    subtitle.style.fontSize = '12px';
    subtitle.style.opacity = '0.78';
    subtitle.style.maxWidth = '34ch';
    titleWrap.appendChild(subtitle);
  }
  const goldLabel = document.createElement('div');
  goldLabel.textContent = `Gold: ${gold}`;
  goldLabel.style.marginLeft = 'auto'; goldLabel.style.color = '#ffde5a'; goldLabel.style.fontWeight = 'bold';
  header.appendChild(titleWrap); header.appendChild(goldLabel);
  el.appendChild(header);

  if (mode === 'checkout') {
    const billLine = document.createElement('div');
    billLine.textContent = `Amount Due: ${totalBill}g`;
    billLine.style.marginBottom = '10px';
    billLine.style.color = '#ffde5a';
    billLine.style.fontWeight = 'bold';
    el.appendChild(billLine);

    const listContainer = document.createElement('div');
    listContainer.style.maxHeight = '45vh';
    listContainer.style.overflow = 'auto';
    el.appendChild(listContainer);

    const actionsEl = document.createElement('div');
    Object.assign(actionsEl.style, { display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' });
    const payBtn = document.createElement('button');
    payBtn.textContent = 'Pay Bill';
    decorateButton(payBtn);
    payBtn.style.fontWeight = 'bold';
    const returnBtn = document.createElement('button');
    returnBtn.textContent = 'Return Item';
    decorateButton(returnBtn);
    actionsEl.appendChild(payBtn);
    actionsEl.appendChild(returnBtn);
    el.appendChild(actionsEl);

    const hint = document.createElement('div');
    hint.style.marginTop = '8px';
    hint.style.opacity = '0.85';
    hint.style.fontSize = '12px';
    el.appendChild(hint);

    const rows = [];
    if (!unpaidItems.length) {
      const empty = document.createElement('div');
      empty.textContent = '(invoice is empty)';
      listContainer.appendChild(empty);
      returnBtn.disabled = true;
      hint.textContent = 'P=Pay bill \u00b7 Esc=Close';
    } else {
      unpaidItems.forEach((it, idx) => {
        const row = createChooserRow({ marginBottom: '4px' });

        const name = document.createElement('span');
        name.textContent = bracketize(sanitize(it.name || 'item'));
        const rn = String(it.rarityName || 'common').toLowerCase();
        Object.assign(name.style, rarityStyle(rn));

        const price = document.createElement('span');
        price.style.marginLeft = 'auto';
        price.style.color = '#ffde5a';
        price.style.fontWeight = 'bold';
        price.textContent = `${it.price || 0}g`;

        row.appendChild(name);
        if (it.count > 1) {
          const qty = document.createElement('span');
          qty.style.opacity = '0.7';
          qty.textContent = `x${it.count}`;
          row.appendChild(qty);
        }
        row.appendChild(price);
        const rowReturnBtn = document.createElement('button');
        rowReturnBtn.textContent = 'Return';
        decorateButton(rowReturnBtn);
        rowReturnBtn.style.marginLeft = '8px';
        rowReturnBtn.style.minHeight = '32px';
        rowReturnBtn.style.padding = '0 10px';
        row.appendChild(rowReturnBtn);
        row.addEventListener('mouseenter', () => setSel(idx));
        row.addEventListener('click', () => setSel(idx));
        rowReturnBtn.addEventListener('click', (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          returnByIndex(idx);
        });
        listContainer.appendChild(row);
        rows.push(row);
      });
      hint.textContent = 'Select item \u00b7 Return button/Enter=Return \u00b7 P=Pay \u00b7 Esc=Close';
    }

    const { getSel, setSel } = createSimpleSel(rows, unpaidItems.length, (i) => {
      showItemTooltip(unpaidItems[i], rows[i]);
    });
    if (unpaidItems.length) setSel(0);

    function payBill() {
      window.dispatchEvent(new CustomEvent('ui:payBill', {
        detail: { shopkeeperId }
      }));
    }

    function returnSelected() {
      returnByIndex(getSel());
    }

    /**
     * @param {number} idx
     */
    function returnByIndex(idx) {
      const it = unpaidItems[idx];
      if (!it) return;
      pulseRow(rows[idx], 'drop');
      for (const itemId of getUiItemEntityIds(it)) {
        window.dispatchEvent(new CustomEvent('ui:removeFromInvoice', {
          detail: { shopkeeperId, itemId }
        }));
      }
    }

    payBtn.addEventListener('click', payBill);
    returnBtn.addEventListener('click', returnSelected);

    installDetachableKeyHandler(panel, '_shopDetach', (e) => {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(getSel() - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(getSel() + 1); e.preventDefault(); }
      else if (k === 'Escape') { hide(panel); e.preventDefault(); }
      else if (k === 'Enter') { returnSelected(); e.preventDefault(); }
      else if (k === 'p' || k === 'P') { payBill(); e.preventDefault(); }
    });
    return;
  }

  // Tabs
  let activeTab = state.activeTab || 'buy';
  const tabBar = document.createElement('div');
  Object.assign(tabBar.style, { display: 'flex', gap: '4px', marginBottom: '10px' });

  const buyTab = document.createElement('button');
  buyTab.textContent = 'Buy';
  decorateButton(buyTab);

  const sellTab = document.createElement('button');
  sellTab.textContent = 'Sell';
  decorateButton(sellTab);

  const appraiseTab = document.createElement('button');
  appraiseTab.textContent = 'Appraise';
  decorateButton(appraiseTab);

  tabBar.appendChild(buyTab); tabBar.appendChild(sellTab); tabBar.appendChild(appraiseTab);
  el.appendChild(tabBar);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '50vh'; listContainer.style.overflow = 'auto';
  el.appendChild(listContainer);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  el.appendChild(hint);

  let sel = 0;
  let currentItems = [];
  let _listDetach = null;

  function updateTabStyle() {
    buyTab.style.background = activeTab === 'buy' ? '#1a2640' : '#101626';
    buyTab.style.borderColor = activeTab === 'buy' ? '#55aaff' : '#2d3b52';
    sellTab.style.background = activeTab === 'sell' ? '#1a2640' : '#101626';
    sellTab.style.borderColor = activeTab === 'sell' ? '#55aaff' : '#2d3b52';
    appraiseTab.style.background = activeTab === 'appraise' ? '#1a2640' : '#101626';
    appraiseTab.style.borderColor = activeTab === 'appraise' ? '#55aaff' : '#2d3b52';
  }

  function renderList() {
    if (typeof _listDetach === 'function') { try { _listDetach(); } catch (_) {} }
    _listDetach = null;
    listContainer.innerHTML = '';
    sel = 0;
    currentItems = activeTab === 'buy'
      ? shopItems
      : activeTab === 'sell'
        ? playerItems
        : appraisableItems;

    if (!currentItems.length) {
      const empty = document.createElement('div');
      empty.textContent = activeTab === 'buy'
        ? '(nothing for sale)'
        : activeTab === 'sell'
          ? '(nothing to sell)'
          : '(nothing to appraise)';
      listContainer.appendChild(empty);
      hint.textContent = 'Tab=Switch \u00b7 Esc=Close';
      return;
    }

    const rows = currentItems.map((it, idx) => {
      const row = createChooserRow({ marginBottom: '4px' });

      const name = document.createElement('span');
      Object.assign(name.style, rarityStyle(it.rarityName));
      name.textContent = bracketize(sanitize(it.name || 'item'));

      const price = document.createElement('span');
      price.style.marginLeft = 'auto';
      price.style.color = '#ffde5a';
      price.style.fontWeight = 'bold';
      const cost = activeTab === 'buy'
        ? (it.buyPrice || 0)
        : activeTab === 'sell'
          ? (it.sellPrice || 0)
          : (it.appraiseFee || 0);
      price.textContent = `${cost}g`;

      row.appendChild(name);
      if (it.count > 1) {
        const qty = document.createElement('span');
        qty.style.opacity = '0.7'; qty.textContent = `x${it.count}`;
        row.appendChild(qty);
      }
      row.appendChild(price);

      row.addEventListener('mouseenter', () => setSel(idx));
      row.addEventListener('click', () => doTransaction());
      listContainer.appendChild(row);
      return row;
    });

    const { getSel, setSel } = createSimpleSel(rows, currentItems.length, (i) => {
      showItemTooltip(currentItems[i], rows[i]);
    });

    setSel(0);
    hint.textContent = activeTab === 'buy'
      ? '\u2191/\u2193 select \u00b7 Enter=Buy \u00b7 Tab=Sell tab \u00b7 Esc=Close'
      : activeTab === 'sell'
        ? '\u2191/\u2193 select \u00b7 Enter=Sell \u00b7 Tab=Appraise tab \u00b7 Esc=Close'
        : '\u2191/\u2193 select \u00b7 Enter=Appraise \u00b7 Tab=Buy tab \u00b7 Esc=Close';

    function doTransaction() {
      const i = getSel();
      const it = currentItems[i]; if (!it) return;
      const ids = getUiItemEntityIds(it);
      if (!ids.length) return;
      pulseRow(rows[i], activeTab === 'buy' ? 'use' : activeTab === 'sell' ? 'drop' : 'default');
      if (activeTab === 'buy') {
        for (const itemId of ids) {
          window.dispatchEvent(new CustomEvent('ui:requestBuy', {
            detail: { shopkeeperId: state.shopkeeperId, itemId }
          }));
        }
      } else if (activeTab === 'sell') {
        for (const itemId of ids) {
          window.dispatchEvent(new CustomEvent('ui:requestSell', {
            detail: { shopkeeperId: state.shopkeeperId, itemId }
          }));
        }
      } else {
        window.dispatchEvent(new CustomEvent('ui:requestAppraise', {
          detail: { shopkeeperId: state.shopkeeperId, itemId: ids[0] }
        }));
      }
    }

    _listDetach = installDetachableKeyHandler(panel, '_shopListDetach', (e) => {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(getSel() - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(getSel() + 1); e.preventDefault(); }
      else if (k === 'Escape') { hide(panel); e.preventDefault(); }
      else if (k === 'Enter') { doTransaction(); e.preventDefault(); }
      else if (k === 'Tab') {
        e.preventDefault();
        if (activeTab === 'buy') activeTab = 'sell';
        else if (activeTab === 'sell') activeTab = 'appraise';
        else activeTab = 'buy';
        state.activeTab = activeTab;
        updateTabStyle();
        renderList();
      }
    });
  }

  /** @type {any} */ (panel)._shopDetach = () => { if (typeof _listDetach === 'function') _listDetach(); };

  buyTab.addEventListener('click', () => { activeTab = 'buy'; state.activeTab = activeTab; updateTabStyle(); renderList(); });
  sellTab.addEventListener('click', () => { activeTab = 'sell'; state.activeTab = activeTab; updateTabStyle(); renderList(); });
  appraiseTab.addEventListener('click', () => { activeTab = 'appraise'; state.activeTab = activeTab; updateTabStyle(); renderList(); });

  updateTabStyle();
  renderList();
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{chestId:number, label?:string}} state */
export function renderChest(panel, data, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  const chestItems = data?.chestItems || [];
  const playerItems = data?.playerItems || [];
  const containerLabel = state?.label || 'Chest';

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' });
  const title = document.createElement('div');
  title.textContent = containerLabel;
  title.style.fontWeight = 'bold'; title.style.fontSize = '16px';
  header.appendChild(title);
  el.appendChild(header);

  // Tabs
  let activeTab = 'take';
  const tabBar = document.createElement('div');
  Object.assign(tabBar.style, { display: 'flex', gap: '4px', marginBottom: '10px' });

  const takeTab = document.createElement('button');
  takeTab.textContent = 'Take';
  decorateButton(takeTab);

  const putTab = document.createElement('button');
  putTab.textContent = 'Put';
  decorateButton(putTab);

  const takeAllBtn = document.createElement('button');
  takeAllBtn.textContent = 'Take All';
  decorateButton(takeAllBtn);

  tabBar.appendChild(takeTab); tabBar.appendChild(putTab); tabBar.appendChild(takeAllBtn);
  el.appendChild(tabBar);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '36vh'; listContainer.style.overflow = 'auto';
  el.appendChild(listContainer);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  el.appendChild(hint);


  let sel = 0;
  let currentItems = [];

  function updateTabStyle() {
    takeTab.style.background = activeTab === 'take' ? '#1a2640' : '#101626';
    takeTab.style.borderColor = activeTab === 'take' ? '#55aaff' : '#2d3b52';
    putTab.style.background = activeTab === 'put' ? '#1a2640' : '#101626';
    putTab.style.borderColor = activeTab === 'put' ? '#55aaff' : '#2d3b52';
    takeAllBtn.style.display = activeTab === 'take' ? '' : 'none';
  }

  function doTakeAll() {
    if (activeTab !== 'take') return;
    const chestId = Number(state.chestId || 0) | 0;
    if (!(chestId > 0)) return;
    window.dispatchEvent(new CustomEvent('ui:requestChestTakeAll', { detail: { chestId } }));
  }
  takeAllBtn.addEventListener('click', doTakeAll);

  function renderList() {
    listContainer.innerHTML = '';
    sel = 0;
    currentItems = activeTab === 'take' ? chestItems : playerItems;

    if (!currentItems.length) {
      const empty = document.createElement('div');
      empty.textContent = activeTab === 'take' ? `(${containerLabel.toLowerCase()} is empty)` : '(nothing to store)';
      listContainer.appendChild(empty);
      hint.textContent = 'Tab=Switch \u00b7 Esc=Close';
      hideItemTooltip();
      return;
    }

    const rows = currentItems.map((it, idx) => {
      const row = createChooserRow({ marginBottom: '4px' });

      const name = document.createElement('span');
      Object.assign(name.style, rarityStyle(it.rarityName));
      name.textContent = bracketize(sanitize(it.name || 'item'));

      row.appendChild(name);
      if (it.coating && it.coating.kind) {
        const dot = document.createElement('span');
        dot.textContent = '\u2022';
        dot.style.color = it.coating.color || '#66dd66';
        dot.style.fontSize = '14px';
        row.appendChild(dot);
      }
      if (it.count > 1) {
        const qty = document.createElement('span');
        qty.style.opacity = '0.7'; qty.textContent = `x${it.count}`;
        row.appendChild(qty);
      }

      row.addEventListener('mouseenter', () => setSel(idx));
      row.addEventListener('click', () => doTransaction());
      listContainer.appendChild(row);
      return row;
    });

    const { getSel, setSel } = createSimpleSel(rows, currentItems.length, (i) => {
      showItemTooltip(currentItems[i], rows[i], { pinBottomOnMobile: true });
    });

    setSel(0);
    hint.textContent = activeTab === 'take'
      ? '\u2191/\u2193 select \u00b7 Enter=Take \u00b7 a=Take All \u00b7 Tab=Put tab \u00b7 Esc=Close'
      : '\u2191/\u2193 select \u00b7 Enter=Put \u00b7 Tab=Take tab \u00b7 Esc=Close';

    function doTransaction() {
      const idx = getSel();
      const it = currentItems[idx]; if (!it) return;
      const chestId = Number(state.chestId || 0) | 0;
      const itemId = Number(it.id || 0) | 0;
      if (!(chestId > 0) || !(itemId > 0)) return;
      pulseRow(rows[idx], activeTab === 'take' ? 'use' : 'drop');
      if (activeTab === 'take') {
        window.dispatchEvent(new CustomEvent('ui:requestChestTake', {
          detail: { chestId, itemId }
        }));
      } else {
        window.dispatchEvent(new CustomEvent('ui:requestChestPut', {
          detail: { chestId, itemId }
        }));
      }
    }

    installKeyHandler(panel, (e) => {
      if (panel.style.display !== 'block') return;
      const k = e.key;
      if (k === 'ArrowUp') { setSel(getSel() - 1); e.preventDefault(); }
      else if (k === 'ArrowDown') { setSel(getSel() + 1); e.preventDefault(); }
      else if (k === 'Escape') { hide(panel); e.preventDefault(); }
      else if (k === 'Enter') { doTransaction(); e.preventDefault(); }
      else if (k === 'a' && activeTab === 'take') { doTakeAll(); e.preventDefault(); }
      else if (k === 'Tab') {
        e.preventDefault();
        activeTab = activeTab === 'take' ? 'put' : 'take';
        updateTabStyle();
        renderList();
      }
    });
  }

  takeTab.addEventListener('click', () => { activeTab = 'take'; updateTabStyle(); renderList(); });
  putTab.addEventListener('click', () => { activeTab = 'put'; updateTabStyle(); renderList(); });

  updateTabStyle();
  renderList();
}

// --- Book reader overlay (decorative dungeon books) ------------------------
/**
 * @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel
 * @param {string} title
 * @param {string} text
 */
export function renderBookReader(panel, title, text) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' });
  const icon = document.createElement('span');
  icon.textContent = '\uD83D\uDCD6'; // book emoji
  icon.style.fontSize = '22px';
  const heading = document.createElement('span');
  heading.textContent = title;
  Object.assign(heading.style, { fontWeight: 'bold', fontSize: '16px', color: '#c8a882' });
  header.appendChild(icon);
  header.appendChild(heading);
  el.appendChild(header);

  // Body text
  const body = document.createElement('div');
  Object.assign(body.style, {
    padding: '14px 16px',
    border: '1px solid #2d3b52', borderRadius: '6px',
    background: '#0f1421',
    lineHeight: '1.6', fontSize: '14px', color: '#cfe8ff',
    whiteSpace: 'pre-wrap',
  });
  body.textContent = text;
  el.appendChild(body);

  // Hint
  const hint = document.createElement('div');
  Object.assign(hint.style, { marginTop: '12px', opacity: '0.6', fontSize: '11px', textAlign: 'center' });
  hint.textContent = 'Esc=Close';
  el.appendChild(hint);
}

// --- Death log overlay (past deaths from localStorage) ---------------------
/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Array<any>} records */
export function renderDeathLog(panel, records) {
  const existingDetach = /** @type {any} */ (panel)._deathLogDetach;
  if (typeof existingDetach === 'function') {
    try { existingDetach(); } catch (e) { console.debug('[overlay] deathLog detach failed:', e); }
  }

  const el = /** @type {HTMLDivElement} */ (/** @type {any} */(panel)._inner);
  el.innerHTML = '';

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' });
  const skull = document.createElement('span');
  skull.textContent = '\u2620';
  skull.style.fontSize = '22px';
  const title = document.createElement('span');
  title.textContent = 'Book of the Dead';
  Object.assign(title.style, { fontWeight: 'bold', fontSize: '16px', color: '#ff9999' });
  const countBadge = document.createElement('span');
  countBadge.textContent = `${records.length} death${records.length !== 1 ? 's' : ''}`;
  Object.assign(countBadge.style, { marginLeft: 'auto', opacity: '0.7', fontSize: '12px' });
  header.appendChild(skull);
  header.appendChild(title);
  header.appendChild(countBadge);
  el.appendChild(header);

  if (!records.length) {
    const empty = document.createElement('div');
    empty.textContent = 'No deaths recorded yet. Stay alive out there.';
    Object.assign(empty.style, { opacity: '0.6', padding: '20px 0', textAlign: 'center' });
    el.appendChild(empty);
    return;
  }

  const list = document.createElement('div');
  Object.assign(list.style, { display: 'flex', flexDirection: 'column', gap: '6px' });
  el.appendChild(list);

  let sel = 0;

  const rows = records.map((rec, idx) => {
    const row = document.createElement('div');
    Object.assign(row.style, {
      display: 'flex', flexDirection: 'column', gap: '2px',
      padding: '8px 10px', border: '1px solid #2d3b52', borderRadius: '6px',
      background: '#0f1421', cursor: 'default',
    });

    // Top line: name, cause, depth
    const top = document.createElement('div');
    Object.assign(top.style, { display: 'flex', alignItems: 'center', gap: '8px' });

    const name = document.createElement('span');
    name.textContent = rec.playerName || 'Hero';
    Object.assign(name.style, { fontWeight: 'bold', color: '#ff9999' });

    const sep = document.createElement('span');
    sep.textContent = '\u2014';
    sep.style.opacity = '0.4';

    const cause = document.createElement('span');
    if (rec.cause === 'combat' && rec.killerName) {
      cause.textContent = `Slain by ${rec.killerName}`;
      cause.style.color = '#ff6b6b';
    } else if (rec.cause === 'starvation') {
      cause.textContent = 'Starved';
      cause.style.color = '#ffcc66';
    } else if (rec.cause === 'trap') {
      cause.textContent = 'Trap';
      cause.style.color = '#ff8844';
    } else if (rec.cause === 'spell') {
      cause.textContent = 'Magic';
      cause.style.color = '#c47bff';
    } else {
      cause.textContent = rec.cause || 'unknown';
      cause.style.color = '#aabbcc';
    }

    const depthLabel = document.createElement('span');
    depthLabel.textContent = `Depth ${rec.depth || '?'}`;
    Object.assign(depthLabel.style, { marginLeft: 'auto', color: '#88aacc', fontSize: '12px' });

    top.appendChild(name);
    top.appendChild(sep);
    top.appendChild(cause);
    top.appendChild(depthLabel);
    row.appendChild(top);

    // Bottom line: turn + timestamp
    const bottom = document.createElement('div');
    Object.assign(bottom.style, { display: 'flex', gap: '12px', fontSize: '11px', opacity: '0.55' });

    if (rec.turn) {
      const turnLabel = document.createElement('span');
      turnLabel.textContent = `Turn ${rec.turn}`;
      bottom.appendChild(turnLabel);
    }
    if (rec.timestamp) {
      const dateLabel = document.createElement('span');
      dateLabel.style.marginLeft = 'auto';
      try {
        dateLabel.textContent = new Date(rec.timestamp).toLocaleDateString(undefined, {
          year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
      } catch {
        dateLabel.textContent = String(rec.timestamp);
      }
      bottom.appendChild(dateLabel);
    }
    row.appendChild(bottom);

    row.addEventListener('mouseenter', () => setSel(idx));
    list.appendChild(row);
    return row;
  });

  const hint = document.createElement('div');
  Object.assign(hint.style, { marginTop: '10px', opacity: '0.6', fontSize: '11px', textAlign: 'center' });
  hint.textContent = '\u2191/\u2193 scroll \u00b7 Esc=Close \u00b7 # to toggle';
  el.appendChild(hint);

  function setSel(i) {
    sel = Math.max(0, Math.min(records.length - 1, i | 0));
    for (let j = 0; j < rows.length; j++) {
      rows[j].style.outline = (j === sel) ? '1px solid #55aaff' : 'none';
      rows[j].style.background = (j === sel) ? UI.SEL_BG : UI.DEFAULT_BG;
    }
    rows[sel]?.scrollIntoView?.({ block: 'nearest' });
  }

  setSel(0);

  installDetachableKeyHandler(panel, '_deathLogDetach', (e) => {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(sel - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(sel + 1); e.preventDefault(); }
    else if (k === 'Home') { setSel(0); e.preventDefault(); }
    else if (k === 'End') { setSel(records.length - 1); e.preventDefault(); }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
  });
}

/** @param {HTMLDivElement & {_inner?:HTMLDivElement}} panel @param {Object} data @param {{rackId:number}} state */
export function renderRack(panel, data, state) {
  const el = /** @type {HTMLDivElement} */ (/** @type {any} */ (panel)._inner);
  el.innerHTML = '';

  const rackItems = /** @type {any[]} */ ((/** @type {any} */ (data))?.rackItems || []);

  // Header
  const header = document.createElement('div');
  Object.assign(header.style, { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' });
  const title = document.createElement('div');
  title.textContent = 'Weapon Rack';
  title.style.fontWeight = 'bold'; title.style.fontSize = '16px';
  header.appendChild(title);
  el.appendChild(header);

  const listContainer = document.createElement('div');
  listContainer.style.maxHeight = '50vh'; listContainer.style.overflow = 'auto';
  el.appendChild(listContainer);

  const hint = document.createElement('div');
  hint.style.marginTop = '8px'; hint.style.opacity = '0.85'; hint.style.fontSize = '12px';
  el.appendChild(hint);

  if (!rackItems.length) {
    const empty = document.createElement('div');
    empty.textContent = '(rack is empty)';
    listContainer.appendChild(empty);
    hint.textContent = 'Esc=Close';
    return;
  }

  const rows = rackItems.map((it, idx) => {
    const row = createChooserRow({ marginBottom: '4px' });

    const name = document.createElement('span');
    Object.assign(name.style, rarityStyle(it.rarityName));
    name.textContent = bracketize(sanitize(it.name || 'item'));
    row.appendChild(name);

    if ((it.count || 1) > 1) {
      const qty = document.createElement('span');
      qty.style.opacity = '0.7'; qty.textContent = `x${it.count}`;
      row.appendChild(qty);
    }

    if (it.slot) {
      const slotBadge = document.createElement('span');
      slotBadge.textContent = it.slot;
      Object.assign(slotBadge.style, { marginLeft: 'auto', opacity: '0.5', fontSize: '11px' });
      row.appendChild(slotBadge);
    }

    row.addEventListener('mouseenter', () => setSel(idx));
    row.addEventListener('click', () => doTake());
    listContainer.appendChild(row);
    return row;
  });

  const { getSel, setSel } = createSimpleSel(rows, rackItems.length, (i) => {
    showItemTooltip(rackItems[i], rows[i]);
  });

  setSel(0);
  hint.textContent = '\u2191/\u2193 select \u00b7 Enter=Take \u00b7 Esc=Close';

  function doTake() {
    const i = getSel();
    const it = rackItems[i]; if (!it) return;
    const rackId = Number(state.rackId || 0) | 0;
    const itemId = Number(it.id || 0) | 0;
    if (!(rackId > 0) || !(itemId > 0)) return;
    pulseRow(rows[i], 'equip');
    window.dispatchEvent(new CustomEvent('ui:requestRackTake', { detail: { rackId, itemId } }));
  }

  installKeyHandler(panel, (e) => {
    if (panel.style.display !== 'block') return;
    const k = e.key;
    if (k === 'ArrowUp') { setSel(getSel() - 1); e.preventDefault(); }
    else if (k === 'ArrowDown') { setSel(getSel() + 1); e.preventDefault(); }
    else if (k === 'Escape') { hide(panel); e.preventDefault(); }
    else if (k === 'Enter') { doTake(); e.preventDefault(); }
  });
}
