// display/input/InputRouter.js
// Routes normalized actions to either rules sink or display sink.
// Stay display-only: do not import rules.

import { Actions, defaultActionSinks, Sinks } from "./actions.js";
import { InputManager } from "./InputManager.js";

/**
 * setupInput wires listeners and routing.
 * @param {Object} opts
 * - canvas: HTMLCanvasElement to attach pointer listeners
 * - rulesHandler: fn(action) for rules-bound actions
 * - displayHandler: fn(action) for display-bound actions
 * - actionSinks: optional override map action->sink
 * - onDispose: optional array to push disposer fns
 */
export function setupInput(opts = {}) {
  const {
    canvas = null,
    rulesHandler = null,
    displayHandler = null,
    actionSinks = defaultActionSinks,
    onDispose = null,
    touchFeedback = true,
    camera = null,
    getPointerOrigin = null,
  } = opts;

  const mgr = new InputManager(window, {
    canvas,
    touchFeedback,
    camera,
    getPointerOrigin,
  });

  const off = mgr.onAction((action) => {
    const sink = actionSinks[action.type] || null;
    if (!sink) return;
    if (sink === Sinks.rules && typeof rulesHandler === "function") {
      rulesHandler(action);
    } else if (sink === Sinks.display && typeof displayHandler === "function") {
      displayHandler(action);
    }
  });

  const dispose = () => { off(); mgr.dispose(); };
  if (Array.isArray(onDispose)) onDispose.push(dispose);
  return { manager: mgr, dispose };
}

export { Actions, Sinks } from "./actions.js";
