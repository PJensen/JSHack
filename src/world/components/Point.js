// Point.js - Component for floating-point positions (e.g., particles, renderers)
// Usage: Attach to entities needing sub-tile or smooth movement

export default function Point(x = 0.0, y = 0.0) {
    return {
        x: parseFloat(x),
        y: parseFloat(y)
    };
}
