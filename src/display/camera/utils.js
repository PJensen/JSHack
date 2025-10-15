// display/camera/utils.js
// Convenience actions for the director or UI

export function jumpTo(cam, { x, y }) {
  cam.x = cam.targetX = x;
  cam.y = cam.targetY = y;
}

export function easeTo(cam, { x, y, scale, dur = 0.6 }) {
  cam.targetX = x ?? cam.targetX;
  cam.targetY = y ?? cam.targetY;
  if (scale !== undefined) cam.targetScale = scale;
  cam.lerpSpeed = 1 / dur;
}

export function zoomTo(cam, scale, dur = 0.5) {
  cam.targetScale = scale;
  cam.lerpSpeed = 1 / dur;
}
