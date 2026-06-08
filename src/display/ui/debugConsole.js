// display/ui/debugConsole.js
// Quake-style drop-down debug console. Tilde (~) to toggle.

const _installed = Symbol.for('jshack:debugConsole:installed');

/**
 * Initialize the debug console overlay.
 * @param {{ world: object, messageLog: { log(msg: object): void } }} deps
 * @returns {{ registerCommand(name: string, helpText: string, handler: function): void, log(text: string, type?: string): void }}
 */
export function initDebugConsole({ world, messageLog }) {
  if (/** @type {any} */ (world)[_installed]) return /** @type {any} */ (world)[_installed];

  const commands = new Map();
  const HISTORY_KEY = 'jshack:debugConsole:history';
  const HISTORY_MAX = 100;
  let history;
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    history = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(history)) history = [];
    history = history.slice(-HISTORY_MAX);
  } catch { history = []; }
  let historyIdx = history.length;
  const outputLines = [];   // { text, type:'cmd'|'ok'|'err'|'debug' }
  let open = false;

  // --- DOM ---
  const panel = document.createElement('div');
  panel.className = 'ui-panel ui-panel-debugConsole';
  Object.assign(panel.style, {
    position: 'fixed', left: '0', top: '0', right: '0', bottom: '0',
    display: 'none', pointerEvents: 'auto',
    background: 'transparent',
    zIndex: '1300',
    fontFamily: 'monospace',
  });

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'absolute', left: '50%', top: '0',
    transform: 'translateX(-50%)',
    width: 'min(880px, calc(100vw - 40px))',
    maxHeight: '40vh',
    display: 'flex', flexDirection: 'column',
    background: 'rgba(6,10,18,0.88)',
    backdropFilter: 'blur(4px)',
    border: '1px solid #2d3b52', borderTop: 'none',
    borderRadius: '0 0 8px 8px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
    padding: '8px 12px',
    boxSizing: 'border-box',
    color: '#cfe8ff',
    fontSize: '14px',
  });

  // Header
  const header = document.createElement('div');
  header.textContent = 'Debug Console  (~ to close)';
  Object.assign(header.style, {
    fontWeight: 'bold', marginBottom: '6px', opacity: '0.6', fontSize: '12px',
  });
  container.appendChild(header);

  // Output area
  const output = document.createElement('div');
  Object.assign(output.style, {
    flex: '1', overflowY: 'auto', overflowX: 'hidden',
    minHeight: '60px', maxHeight: 'calc(40vh - 80px)',
    marginBottom: '6px',
  });
  output.dataset.allowScroll = 'true';
  output.style.touchAction = 'pan-y';
  output.style.overscrollBehavior = 'contain';
  container.appendChild(output);

  // Input row
  const inputRow = document.createElement('div');
  Object.assign(inputRow.style, {
    display: 'flex', alignItems: 'center', gap: '4px',
  });
  const prompt = document.createElement('span');
  prompt.textContent = '>';
  prompt.style.color = '#5fb3ff';
  prompt.style.fontWeight = 'bold';
  inputRow.appendChild(prompt);

  const input = document.createElement('input');
  input.type = 'text';
  input.autocomplete = 'off';
  input.spellcheck = false;
  Object.assign(input.style, {
    flex: '1',
    background: 'transparent', border: 'none', outline: 'none',
    color: '#e6f2ff', fontFamily: 'monospace', fontSize: '14px',
    lineHeight: '1.4', padding: '2px 0',
    caretColor: '#5fb3ff',
    userSelect: 'text', WebkitUserSelect: 'text',
  });
  inputRow.appendChild(input);
  container.appendChild(inputRow);

  panel.appendChild(container);

  // Do not auto-close on backdrop clicks; keep the console open until the user
  // explicitly closes it with ~ or Escape.
  panel.addEventListener('pointerdown', (ev) => {
    if (ev.target === panel) {
      ev.preventDefault();
      input.focus();
    }
  });

  // Append to ui-root or body
  const root = document.getElementById('ui-root') || document.body;
  root.appendChild(panel);

  // --- Output rendering ---
  function appendOutput(text, type = 'ok') {
    outputLines.push({ text, type });
    if (outputLines.length > 200) outputLines.shift();
    renderOutput();
  }

  function renderOutput() {
    output.innerHTML = '';
    for (const line of outputLines) {
      const div = document.createElement('div');
      div.style.whiteSpace = 'pre-wrap';
      div.style.wordBreak = 'break-word';
      div.style.lineHeight = '1.4';
      if (line.type === 'cmd') {
        div.style.color = '#8899aa';
        div.textContent = `> ${line.text}`;
      } else if (line.type === 'debug') {
        div.style.color = '#8fd3ff';
        div.style.paddingLeft = '10px';
        div.style.borderLeft = '2px solid rgba(95,179,255,0.45)';
        div.textContent = line.text;
      } else if (line.type === 'err') {
        div.style.color = '#ff6b6b';
        div.textContent = line.text;
      } else {
        div.style.color = '#6bffb8';
        div.textContent = line.text;
      }
      output.appendChild(div);
    }
    output.scrollTop = output.scrollHeight;
  }

  // --- Command execution ---
  function execute(raw) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    history.push(trimmed);
    if (history.length > HISTORY_MAX) history.splice(0, history.length - HISTORY_MAX);
    historyIdx = history.length;
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch {}
    appendOutput(trimmed, 'cmd');

    const spaceIdx = trimmed.indexOf(' ');
    const name = (spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx)).toLowerCase();
    const argsStr = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();

    const cmd = commands.get(name);
    if (!cmd) {
      appendOutput(`Unknown command: "${name}". Type 'help' for available commands.`, 'err');
      return;
    }
    try {
      const result = cmd.handler(argsStr, { world, messageLog });
      if (result && typeof result.then === 'function') {
        result.then((resolved) => {
          if (resolved != null && resolved !== '') appendOutput(String(resolved), 'ok');
        }).catch((err) => {
          appendOutput(`Error: ${err?.message || err}`, 'err');
        });
      } else if (result != null && result !== '') {
        appendOutput(String(result), 'ok');
      }
    } catch (err) {
      appendOutput(`Error: ${err.message || err}`, 'err');
    }
    world.tick(0);
  }

  // --- Open / Close ---
  function toggle() {
    if (open) close(); else openConsole();
  }

  function openConsole() {
    open = true;
    panel.style.display = 'block';
    input.value = '';
    historyIdx = history.length;
    input.focus();
  }

  function close() {
    open = false;
    panel.style.display = 'none';
    input.blur();
  }

  // --- Keyboard ---
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') {
      e.preventDefault();
      e.stopPropagation();
      toggle();
      return;
    }
    if (!open) return;

    // Console is open — claim ALL keys so lockdown/InputManager cannot intercept.
    e.stopImmediatePropagation();

    if (e.key === 'Escape') {
      e.preventDefault();
      close();
      return;
    }

    // Input is focused — let browser handle text entry.
    // Handle special keys for command history and execution.
    if (e.key === 'Enter') {
      e.preventDefault();
      execute(input.value);
      input.value = '';
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length && historyIdx > 0) {
        historyIdx--;
        input.value = history[historyIdx];
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIdx < history.length - 1) {
        historyIdx++;
        input.value = history[historyIdx];
      } else {
        historyIdx = history.length;
        input.value = '';
      }
      return;
    }
  }, true); // capture phase: fire before InputManager

  // --- Built-in: help & clear ---
  commands.set('help', {
    helpText: 'List available commands',
    handler() {
      const lines = ['Available commands:'];
      for (const [name, cmd] of commands) {
        lines.push(`  ${name} — ${cmd.helpText}`);
      }
      return lines.join('\n');
    },
  });

  commands.set('clear', {
    helpText: 'Clear console output',
    handler() {
      outputLines.length = 0;
      renderOutput();
      return null;
    },
  });

  // --- Public API ---
  const api = Object.freeze({
    registerCommand(name, helpText, handler) {
      commands.set(name.toLowerCase(), { helpText, handler });
    },
    log(text, type = 'debug') {
      if (text == null || text === '') return;
      appendOutput(String(text), type);
    },
  });

  /** @type {any} */ (world)[_installed] = api;
  return api;
}
