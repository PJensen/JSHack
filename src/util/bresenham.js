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

// TODO: this shoudl be re-enabled once we have a proper map structure; ideally in some system
// // map is expected to implement blocksLight(x,y) or a similar predicate
// export function hasLine(map, x0, y0, x1, y1){
//   for (const [x,y] of bresenhamLine(x0,y0,x1,y1)){
//     if (x === x1 && y === y1) return true;
//     if (typeof map.blocksLight === 'function'){
//       if (map.blocksLight(x,y)) return false;
//     } else if (map && map.inBounds){
//       // fallback: if map provides tiles as map.t[y][x] with .block truthy
//       try {
//         if (map.t && map.t[y] && map.t[y][x] && map.t[y][x].block) return false;
//       } catch(e){ /* ignore and continue */ }
//     }
//   }
//   return true;
// }
