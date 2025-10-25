// dungeonGeneratorSystem.js
// Purpose: Rooms + Corridors + Doors dungeon generator (ported to ECS)
// Normalized to core World API (world.query/create/add/get/set)

import { Dungeon } from '../../components/Dungeon.js';
import { DungeonLevel } from '../../components/DungeonLevel.js';
import { Tile } from '../../components/Tile.js';
import { Position } from '../../components/Position.js';
import { MapView } from '../../components/MapView.js';
import { CONFIG } from '../../../config.js';
// Torch factory for starting room
import { createDeferred } from '../../../lib/ecs/archetype.js';
import { TorchArchetype } from '../../archetypes/TorchArchetype.js';

// Glyph mapping (minimal set requested)
const WALL_GLYPH = CONFIG.wallGlyph || '█';
const GLYPH = {
    WALL: WALL_GLYPH,
    FLOOR: '·',
    DOOR: '🚪',
    WATER: '≈',
    TRAP: '^',
    FOUNTAIN: '⛲',
    SINK: '🕳',
    ALTAR: '⎈',
    THRONE: '♛',
    GRAVE: '†',
    STAIR: '>'
};

function makeTile(type){
    switch(type){
        case 'wall': return { glyph: GLYPH.WALL, walkable: false, blocksLight: true };
        case 'door': return { glyph: GLYPH.DOOR, walkable: true,  blocksLight: false };
        case 'water': return { glyph: GLYPH.WATER, walkable: false, blocksLight: false };
        case 'trap': return { glyph: GLYPH.TRAP, walkable: true,  blocksLight: false };
        case 'fountain': return { glyph: GLYPH.FOUNTAIN, walkable: false, blocksLight: false };
        case 'sink': return { glyph: GLYPH.SINK, walkable: true, blocksLight: false };
        case 'altar': return { glyph: GLYPH.ALTAR, walkable: false, blocksLight: false };
        case 'throne': return { glyph: GLYPH.THRONE, walkable: false, blocksLight: false };
        case 'grave': return { glyph: GLYPH.GRAVE, walkable: false, blocksLight: false };
        case 'stair': return { glyph: GLYPH.STAIR, walkable: true,  blocksLight: false };
        case 'void': return { glyph: '', walkable: false, blocksLight: false }; // empty void space
        default: return { glyph: GLYPH.FLOOR, walkable: true, blocksLight: false };
    }
}

class Rect {
    constructor(x, y, w, h){ this.x=x|0; this.y=y|0; this.w=w|0; this.h=h|0; this.x2=this.x+this.w-1; this.y2=this.y+this.h-1; }
    center(){ return [ (this.x + this.x2) >> 1, (this.y + this.y2) >> 1 ]; }
    intersects(other){ return !(this.x2 < other.x || this.x > other.x2 || this.y2 < other.y || this.y > other.y2); }
    // Pick a point on the edge of this room that faces (tx,ty)
    edgeToward(tx, ty){
        // Find clamped target within rect bounds to determine which edge is "closest"
        const cx = Math.max(this.x, Math.min(this.x2, tx|0));
        const cy = Math.max(this.y, Math.min(this.y2, ty|0));
        // Compute distance to each edge from clamped point
        const dxL = Math.abs(cx - this.x);
        const dxR = Math.abs(this.x2 - cx);
        const dyT = Math.abs(cy - this.y);
        const dyB = Math.abs(this.y2 - cy);
        // Choose the nearest edge, but push 1 tile outside so corridor starts outside the room
        if (dxL <= dxR && dxL <= dyT && dxL <= dyB) return [this.x-1, cy];
        if (dxR <= dyT && dxR <= dyB) return [this.x2+1, cy];
        if (dyT <= dyB) return [cx, this.y-1];
        return [cx, this.y2+1];
    }
}

function carveRoom(map, rect){
    for (let y=rect.y; y<=rect.y2; y++){
        for (let x=rect.x; x<=rect.x2; x++){
            map.t[y][x] = makeTile('floor');
        }
    }
}
function carveHTunnel(map, x1, x2, y){
    const a = Math.min(x1, x2), b = Math.max(x1, x2);
    for (let x=a; x<=b; x++){ if (map.inBounds(x,y)) map.t[y][x] = makeTile('floor'); }
}
function carveVTunnel(map, y1, y2, x){
    const a = Math.min(y1, y2), b = Math.max(y1, y2);
    for (let y=a; y<=b; y++){ if (map.inBounds(x,y)) map.t[y][x] = makeTile('floor'); }
}

// Wide corridors: carve a band of floors around the line
function carveHTunnelWide(map, x1, x2, y, w){
    const a = Math.min(x1, x2), b = Math.max(x1, x2);
    const half = Math.max(0, Math.floor((w|0)/2));
    for (let x=a; x<=b; x++){
        for (let dy=-half; dy<=half; dy++){
            const yy = y + dy;
            if (map.inBounds(x, yy)) map.t[yy][x] = makeTile('floor');
        }
    }
}
function carveVTunnelWide(map, y1, y2, x, w){
    const a = Math.min(y1, y2), b = Math.max(y1, y2);
    const half = Math.max(0, Math.floor((w|0)/2));
    for (let y=a; y<=b; y++){
        for (let dx=-half; dx<=half; dx++){
            const xx = x + dx;
            if (map.inBounds(xx, y)) map.t[y][xx] = makeTile('floor');
        }
    }
}

// Place walls adjacent to floors (but not replacing floors)
function placeWalls(map){
    for (let y=0; y<map.h; y++){
        for (let x=0; x<map.w; x++){
            const t = map.t[y][x];
            // Skip if already floor/door or other feature
            if (t.glyph !== '') continue;
            // Check if adjacent to floor
            let adjFloor = false;
            for (let dy=-1; dy<=1; dy++){
                for (let dx=-1; dx<=1; dx++){
                    if (dx===0 && dy===0) continue;
                    const nx = x + dx, ny = y + dy;
                    if (!map.inBounds(nx, ny)) continue;
                    const nt = map.t[ny][nx];
                    if (nt.walkable) { adjFloor = true; break; }
                }
                if (adjFloor) break;
            }
            if (adjFloor) map.t[y][x] = makeTile('wall');
        }
    }
}

function placeDoors(map){
    for (let y=1; y<map.h-1; y++){
        for (let x=1; x<map.w-1; x++){
            const t = map.t[y][x];
            if (t.glyph !== GLYPH.WALL) continue;
            const up = map.t[y-1][x], down = map.t[y+1][x];
            const left = map.t[y][x-1], right = map.t[y][x+1];
            const upWalk = !!up.walkable, downWalk = !!down.walkable, leftWalk = !!left.walkable, rightWalk = !!right.walkable;
            const vertPass = upWalk && downWalk && !leftWalk && !rightWalk;
            const horizPass= leftWalk && rightWalk && !upWalk && !downWalk;
            if (vertPass || horizPass){
                const diagWalls =
                    Number(!(map.t[y-1][x-1].walkable)) + Number(!(map.t[y-1][x+1].walkable)) +
                    Number(!(map.t[y+1][x-1].walkable)) + Number(!(map.t[y+1][x+1].walkable));
                if (diagWalls >= 2){
                    const noAdjDoor = (map.t[y][x-1].glyph!==GLYPH.DOOR && map.t[y][x+1].glyph!==GLYPH.DOOR && map.t[y-1][x].glyph!==GLYPH.DOOR && map.t[y+1][x].glyph!==GLYPH.DOOR);
                    if (noAdjDoor) map.t[y][x] = makeTile('door');
                }
            }
        }
    }
}

function makeGameMap(w,h){
    const t = Array.from({length:h}, ()=>Array.from({length:w}, ()=>makeTile('void')));
    return {
        w, h, t,
        inBounds(x,y){ return x>=0 && y>=0 && x<w && y<h; }
    };
}

function generateDungeonLevel(rng, width, height){
    const map = makeGameMap(width, height);
    // No border walls - rooms are islands in the void

    const rooms = [];
    // Compact defaults: more, smaller rooms, closer together
    const MAX_ROOMS = (CONFIG.roomMaxCompact ?? CONFIG.roomMax ?? 18) | 0;
    const ROOM_W_MIN = (CONFIG.roomMinSizeCompact ?? 3) | 0;
    const ROOM_W_MAX = (CONFIG.roomMaxSizeCompact ?? 8) | 0;
    const ROOM_H_MIN = (CONFIG.roomMinSizeCompact ?? 3) | 0;
    const ROOM_H_MAX = (CONFIG.roomMaxSizeCompact ?? 8) | 0;
    const CORRIDOR_W_MIN = (CONFIG.corridorMinWidth ?? 2) | 0;
    const CORRIDOR_W_MAX = (CONFIG.corridorMaxWidth ?? 5) | 0;

    for (let i=0; i<MAX_ROOMS; i++){
        const rw = ROOM_W_MIN + Math.floor(rng() * (ROOM_W_MAX - ROOM_W_MIN + 1));
        const rh = ROOM_H_MIN + Math.floor(rng() * (ROOM_H_MAX - ROOM_H_MIN + 1));
        // Bias placement toward the center using a triangular distribution
        const uX = (rng() + rng()) * 0.5; // 0..1 peaking at 0.5
        const uY = (rng() + rng()) * 0.5;
        const rx = 1 + Math.floor(uX * (width - rw - 2));
        const ry = 1 + Math.floor(uY * (height - rh - 2));
        const room = new Rect(rx, ry, rw, rh);
        if (rooms.some(r => r.intersects(room))) continue;
        carveRoom(map, room);
        rooms.push(room);

        // Connect to the nearest existing room to keep corridors short
        if (rooms.length > 1){
            const [cx, cy] = room.center();
            let best = null, bestDist = 1e9;
            for (let j=0; j<rooms.length-1; j++){
                const [px, py] = rooms[j].center();
                const dx = px - cx, dy = py - cy;
                const d2 = dx*dx + dy*dy;
                if (d2 < bestDist){ bestDist = d2; best = rooms[j]; }
            }
            const cw = Math.max(CORRIDOR_W_MIN, Math.min(CORRIDOR_W_MAX, 2 + ((rng()* (CORRIDOR_W_MAX - CORRIDOR_W_MIN + 1))|0)));
            if (best){
                const [sx, sy] = room.edgeToward(...best.center());
                const [tx, ty] = best.edgeToward(sx, sy);
                if (rng() < 0.5){
                    carveHTunnelWide(map, sx, tx, sy, cw);
                    carveVTunnelWide(map, sy, ty, tx, cw);
                } else {
                    carveVTunnelWide(map, sy, ty, sx, cw);
                    carveHTunnelWide(map, sx, tx, ty, cw);
                }
            }
            // Occasionally add a secondary short connection for a maze-like feel
            if (rng() < 0.33 && rooms.length > 2){
                // Pick among last few rooms to keep it local
                const startJ = Math.max(0, rooms.length - 5);
                const cand = rooms.slice(startJ, rooms.length-1);
                let alt = null, altDist = 1e9;
                for (const r of cand){
                    const [px, py] = r.center();
                    const dx = px - cx, dy = py - cy;
                    const d2 = dx*dx + dy*dy;
                    if (d2 < altDist){ altDist = d2; alt = r; }
                }
                if (alt && altDist < 200){ // only if quite close
                    const w2 = Math.max(CORRIDOR_W_MIN, Math.min(CORRIDOR_W_MAX, 2 + ((rng()* (CORRIDOR_W_MAX - CORRIDOR_W_MIN + 1))|0)));
                    const [sx2, sy2] = room.edgeToward(...alt.center());
                    const [tx2, ty2] = alt.edgeToward(sx2, sy2);
                    if (rng() < 0.5){
                        carveHTunnelWide(map, sx2, tx2, sy2, w2);
                        carveVTunnelWide(map, sy2, ty2, tx2, w2);
                    } else {
                        carveVTunnelWide(map, sy2, ty2, sx2, w2);
                        carveHTunnelWide(map, sx2, tx2, ty2, w2);
                    }
                }
            }
        }
    }

    // Place walls around carved areas
    placeWalls(map);

    // Doors pass
    placeDoors(map);

    // Sprinkle terrain variants inside rooms/corridors
    for (let y=2; y<height-2; y++){
        for (let x=2; x<width-2; x++){
            const cell = map.t[y][x];
            if (cell.glyph !== GLYPH.FLOOR) continue;
            const r = rng();
            if (r < 0.0015){
                map.t[y][x] = makeTile('fountain');
            } else if (r < 0.003){
                map.t[y][x] = makeTile('sink');
            } else if (r < 0.0045){
                map.t[y][x] = makeTile('water');
            } else if (r < 0.006){
                map.t[y][x] = makeTile('trap');
            }
        }
    }

    // Player spawn = center of first room (fallback)
    let spawnX = 6, spawnY = 6;
    if (rooms.length){ [spawnX, spawnY] = rooms[0].center(); }

    // No stairs (per user request)

    // One special feature per some rooms
    for (const room of rooms){
        if (rng() < 0.22){
            const cx = room.x + 1 + Math.floor(rng() * Math.max(1, room.w - 2));
            const cy = room.y + 1 + Math.floor(rng() * Math.max(1, room.h - 2));
            if (!map.inBounds(cx, cy)) continue;
            if (map.t[cy][cx].glyph !== GLYPH.FLOOR) continue;
            const pick = rng();
            if (pick < 0.35) map.t[cy][cx] = makeTile('altar');
            else if (pick < 0.7) map.t[cy][cx] = makeTile('throne');
            else map.t[cy][cx] = makeTile('grave');
        }
    }

    return { map, rooms, spawnX, spawnY };
}

export function dungeonGeneratorSystem(world){
    // For each dungeon level, if not generated, create tiles/entities
    for (const [eid, dng, lvl] of world.query(Dungeon, DungeonLevel)) {
        if (lvl && lvl.generated) continue;

        // Important: mark as generated immediately (in-place) to avoid re-entry this tick
        // when thousands of deferred add/set commands are queued. In-place mutation is
        // allowed and avoids deferral; we don't rely on Changed(DungeonLevel) here.
        if (lvl) lvl.generated = true;

        // Dimensions: derive from CONFIG or use reasonable defaults
        const requestedW = (lvl && lvl.width) || (CONFIG.cols || 80);
        const requestedH = (lvl && lvl.height) || (CONFIG.rows || 48);
        const width = Math.max(10, requestedW|0);
        const height = Math.max(10, requestedH|0);

        const rng = typeof world.rand === 'function' ? world.rand : Math.random;
    const { map, spawnX, spawnY } = generateDungeonLevel(rng, width, height);

                // Note: Avoid creating per-cell tile entities to keep the world lightweight.
                // Rendering and movement will consult MapView instead.

                // Update the pre-created MapView in-place so it's usable immediately this frame
                try{
                    let mvId = world.mapViewId || 0;
                    let mvRec = null;
                    if (mvId && world.has(mvId, MapView)) mvRec = world.get(mvId, MapView);
                    else {
                        // Fallback: find any MapView
                        for (const [id, mv] of world.query(MapView)) { mvId = id; mvRec = mv; break; }
                    }
                    if (mvRec){
                        const glyphAt = (x, y) => {
                            if (x < 0 || y < 0 || x >= map.w || y >= map.h) return '';
                            return map.t[y][x].glyph;
                        };
                        const tileAt = (x, y) => {
                            if (x < 0 || y < 0 || x >= map.w || y >= map.h) return null;
                            return map.t[y][x];
                        };
                        // Precompute an opacity grid for fast lookups
                        let opaque = null;
                        try{
                            opaque = new Uint8Array(map.w * map.h);
                            for (let y=0; y<map.h; y++){
                                for (let x=0; x<map.w; x++){
                                    const t = map.t[y][x];
                                    opaque[y*map.w + x] = (t && t.blocksLight) ? 1 : 0;
                                }
                            }
                        }catch(_){}
                        const opaqueAt = (x, y) => {
                            if (x < 0 || y < 0 || x >= map.w || y >= map.h) return true; // out of bounds = opaque
                            if (opaque) return !!opaque[y*map.w + x];
                            const t = map.t[y][x];
                            return !!(t && t.blocksLight);
                        };
                        mvRec.w = map.w; mvRec.h = map.h; mvRec.glyphAt = glyphAt; mvRec.tileAt = tileAt; mvRec.opaqueAt = opaqueAt;
                        mvRec.visibleMask = null; mvRec.seenMask = null;
                        if (mvId) world.markChanged(mvId, MapView);
                    }
                }catch(e){ /* ignore if MapView unavailable */ }

            // Persist spawn info (set is deferred; generated already set in-place)
            world.set(eid, DungeonLevel, {
                spawn: { x: spawnX, y: spawnY },
            });

            // Place a torch in the starting room (offset by +1 x to avoid player tile)
            try{
                createDeferred(world, TorchArchetype, {
                    Position: { x: (spawnX | 0) + 1, y: (spawnY | 0) }
                    // Glyph/Light/Emissive: use archetype defaults
                });
            }catch(e){ /* skip torch creation errors without crashing generation */ }
    }
}
