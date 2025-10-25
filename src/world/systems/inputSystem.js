// Input System
// Captures keyboard input and translates it to InputIntent for the player
import { Player } from '../components/Player.js';
import { InputIntent } from '../components/InputIntent.js';

// Track keys pressed this frame
const keysPressed = new Set();
// Edge-triggered movement: set true on keydown/touchstart for movement, consumed next update
let edgeMoveRequested = false;
// Pending one-shot movement from a touch gesture (cardinalized)
let pendingTouch = null; // { dx, dy }
let touchActive = false;

function isMovementKey(key){
  const k = key.toLowerCase();
  return (
    k === 'w' || k === 'a' || k === 's' || k === 'd' ||
    k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright' ||
    k === '8' || k === '2' || k === '4' || k === '6' ||
    k === '7' || k === '9' || k === '1' || k === '3' ||
    k === 'h' || k === 'j' || k === 'k' || k === 'l' ||
    k === 'y' || k === 'u' || k === 'b' || k === 'n'
  );
}

// Setup keyboard listeners (call once during init)
export function setupInputListeners() {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    const wasDown = keysPressed.has(key);
    keysPressed.add(key);
    // Edge-trigger: only on first keydown (ignore auto-repeat)
    if (!wasDown && !e.repeat && isMovementKey(key)) edgeMoveRequested = true;
    
    // Prevent arrow keys from scrolling the page
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
      e.preventDefault();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    keysPressed.delete(e.key.toLowerCase());
    // No special handling on keyup; next keydown will trigger a new step
  });

  // Quick and simple touch controls: tap left/right/up/down of canvas center to move one cell
  const canvas = document.getElementById('stage');
  if (canvas) {
    const onTouchStart = (e) => {
      try { e.preventDefault(); } catch(_) {}
      if (touchActive) return; // one move per touch
      const t = e.touches && e.touches[0] ? e.touches[0] : (e.changedTouches && e.changedTouches[0]);
      if (!t) return;
      const rect = canvas.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = t.clientX - cx;
      const dy = t.clientY - cy;
      // Cardinalize: choose the dominant axis
      let move = { dx: 0, dy: 0 };
      if (Math.abs(dx) >= Math.abs(dy)) {
        move.dx = dx < 0 ? -1 : 1;
      } else {
        move.dy = dy < 0 ? -1 : 1;
      }
      pendingTouch = move;
      edgeMoveRequested = true; // trigger one-shot move
      touchActive = true;
    };
    const onTouchEnd = () => { touchActive = false; };
    const opts = { passive: false };
    canvas.addEventListener('touchstart', onTouchStart, opts);
    canvas.addEventListener('touchend', onTouchEnd, opts);
    canvas.addEventListener('touchcancel', onTouchEnd, opts);
  }
}

export function inputSystem(world) {
  // Find the player entity and update their InputIntent based on keys pressed
  for (const [id] of world.query(Player)) {
    let dx = 0, dy = 0;
    
    // WASD movement
    if (keysPressed.has('w') || keysPressed.has('arrowup')) dy -= 1;
    if (keysPressed.has('s') || keysPressed.has('arrowdown')) dy += 1;
    if (keysPressed.has('a') || keysPressed.has('arrowleft')) dx -= 1;
    if (keysPressed.has('d') || keysPressed.has('arrowright')) dx += 1;
    
    // Numpad movement (8426 = up/down/left/right, diagonals: 7913)
    if (keysPressed.has('8')) dy -= 1;
    if (keysPressed.has('2')) dy += 1;
    if (keysPressed.has('4')) dx -= 1;
    if (keysPressed.has('6')) dx += 1;
    if (keysPressed.has('7')) { dx -= 1; dy -= 1; }
    if (keysPressed.has('9')) { dx += 1; dy -= 1; }
    if (keysPressed.has('1')) { dx -= 1; dy += 1; }
    if (keysPressed.has('3')) { dx += 1; dy += 1; }
    
    // Vi keys (hjkl + yubn for diagonals)
    if (keysPressed.has('k')) dy -= 1;
    if (keysPressed.has('j')) dy += 1;
    if (keysPressed.has('h')) dx -= 1;
    if (keysPressed.has('l')) dx += 1;
    if (keysPressed.has('y')) { dx -= 1; dy -= 1; }
    if (keysPressed.has('u')) { dx += 1; dy -= 1; }
    if (keysPressed.has('b')) { dx -= 1; dy += 1; }
    if (keysPressed.has('n')) { dx += 1; dy += 1; }
    
    // Clamp to -1, 0, or 1 (in case multiple keys map to same direction)
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    // If no keyboard direction, check pending touch gesture
    if (dx === 0 && dy === 0 && pendingTouch) {
      dx = pendingTouch.dx | 0;
      dy = pendingTouch.dy | 0;
    }
    
    // Only emit intent on edge (keydown). This makes movement one tile per press.
    if (edgeMoveRequested && (dx !== 0 || dy !== 0)) {
      world.set(id, InputIntent, { dx, dy });
      // consume the edge; movementSystem will clear the intent after applying
      edgeMoveRequested = false;
      pendingTouch = null;
    }
    
    // Only process first player
    break;
  }
}
