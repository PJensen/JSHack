// Bresenham line generator and helper
// Exports:
//   bresenhamLine(x0,y0,x1,y1) -> generator yielding [x,y] coords along line (excludes start, includes end)
//   hasLine(map, x0,y0,x1,y1) -> boolean: true if straight line from start to end does not hit a blocking cell

export function* bresenhamLine(x0, y0, x1, y1){
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  while (!(x === x1 && y === y1)){
    const e2 = 2 * err;
    if (e2 >= dy){ err += dy; x += sx; }
    if (e2 <= dx){ err += dx; y += sy; }
    yield [x, y];
  }
}