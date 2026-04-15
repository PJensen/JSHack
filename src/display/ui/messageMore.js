// src/display/ui/messageMore.js
// NetHack-style "--More--" message queue.
// Queues messages that arrive during a single game tick.  When multiple
// messages are pending the ticker shows one at a time with "--More--"
// and locks player input until the queue is drained.

import { setInputLock } from "../input/inputLock.js";

const LOCK_KEY = "messageMore";

/**
 * @typedef {Object} MessageMoreQueue
 * @property {(entry: any) => void} push       — feed a new message
 * @property {() => void}           advance    — Space / Enter / tap
 * @property {() => void}           beginBatch — call before world.tick
 * @property {() => boolean}        isActive   — true while --More-- is gating
 * @property {() => any[]}          pending    — snapshot of remaining queue
 */

/**
 * @param {Object}   opts
 * @param {(message: any, hasMore: boolean) => void} opts.onDisplay
 *        Called each time the visible topline message changes.
 * @param {() => void} opts.onClear
 *        Called when the queue is drained and normal ticker can resume.
 * @returns {MessageMoreQueue}
 */
export function createMessageMoreQueue({ onDisplay, onClear }) {
  /** @type {any[]} */
  const queue = [];
  /** @type {any|null} */
  let current = null;
  let gating = false;        // true while --More-- prompt is up and input is locked
  let batchScheduled = false; // true while a microtask processBatch is pending
  let armed = false;          // false until first beginBatch — avoids deadlock on startup messages

  function lock() {
    if (!gating) {
      gating = true;
      setInputLock(LOCK_KEY, true);
    }
  }

  function unlock() {
    if (gating) {
      gating = false;
      setInputLock(LOCK_KEY, false);
    }
  }

  /**
   * Feed a new message into the queue.
   * All messages from a single world.tick arrive synchronously, so we
   * accumulate them and process the batch in a microtask (before repaint).
   */
  function push(entry) {
    if (!armed) return; // Ignore startup messages — no player action yet.
    queue.push(entry);
    if (!batchScheduled) {
      batchScheduled = true;
      queueMicrotask(processBatch);
    }
  }

  /** Microtask: decide whether the batch needs --More-- gating. */
  function processBatch() {
    batchScheduled = false;
    if (queue.length <= 1) {
      // Single (or zero) message — no gating needed.  Normal ticker handles it.
      queue.length = 0;
      current = null;
      onClear();
      return;
    }
    // Multiple messages — show first with "--More--" and lock input.
    current = queue.shift();
    lock();
    onDisplay(current, queue.length > 0);
  }

  /** Advance to next queued message (Space / Enter / tap). */
  function advance() {
    if (!gating) return;
    if (queue.length > 0) {
      current = queue.shift();
      const hasMore = queue.length > 0;
      onDisplay(current, hasMore);
      if (!hasMore) {
        // Last message — unlock input but keep message visible until next action.
        unlock();
      }
    } else {
      // Safety: queue empty, clear everything.
      current = null;
      unlock();
      onClear();
    }
  }

  /**
   * Signal that a new player action is about to process.
   * Flushes any leftover queue so stale messages don't block the next turn.
   */
  function beginBatch() {
    armed = true;
    current = null;
    queue.length = 0;
    batchScheduled = false;
    unlock();
    onClear();
  }

  function isActive() {
    return gating;
  }

  function pending() {
    return queue.slice();
  }

  return Object.freeze({ push, advance, beginBatch, isActive, pending });
}
