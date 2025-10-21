// Glyph component for ECS (data only)
import { defineComponent } from '../../lib/ecs/core.js';

// Glyph is a pure data component for ECS entities representing a character and its colors for rendering.
// Fields: char (string), fg/color (string), bg (string|null)
export default defineComponent('Glyph', {
    char: '?',       // The character to display (e.g. '@')
    fg: '#fff',      // Foreground color (CSS string)
    color: '#fff',   // alias
    bg: null         // Optional background color (CSS string or null)
});
