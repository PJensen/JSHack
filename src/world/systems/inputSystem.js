// Input System
// Captures keyboard input and translates it to InputIntent for the player
import { Player } from '../components/Player.js';
import { InputIntent } from '../components/InputIntent.js';

// Track keys pressed this frame
const keysPressed = new Set();

// Setup keyboard listeners (call once during init)
export function setupInputListeners() {
  window.addEventListener('keydown', (e) => {
    keysPressed.add(e.key.toLowerCase());
    
    // Prevent arrow keys from scrolling the page
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
      e.preventDefault();
    }
  });
  
  window.addEventListener('keyup', (e) => {
    keysPressed.delete(e.key.toLowerCase());
  });
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
    
    // Log when we have input
    if (dx !== 0 || dy !== 0) {
      console.log(`Input: dx=${dx}, dy=${dy}`);
    }
    
    // Use world.set() as intended by the ECS
    world.set(id, InputIntent, { dx, dy });
    
    // Only process first player
    break;
  }
}
