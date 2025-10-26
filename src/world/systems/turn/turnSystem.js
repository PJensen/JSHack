// turnSystem.js
// Maintains clean player/monsters turn phases. Player acts once, then all monsters act once.
import { TurnState } from '../../components/TurnState.js';

let inited = false;
let actionThisFrame = false;

export function turnSystem(world){
  // Ensure TurnState singleton exists and cache id on world
  if (!world.turnStateId || !world.get(world.turnStateId, TurnState)){
    try{
      const e = world.create();
      world.add(e, TurnState, { phase: 'player', round: 1 });
      world.turnStateId = e;
    }catch(_){ /* ignore in constrained startup */ }
  }

  // One-time event hook to mark when any entity consumes a turn action this frame
  if (!inited){
    try{
      world.on('turn:action', (_ev)=>{ actionThisFrame = true; });
    }catch(_){ /* ignore */ }
    inited = true;
  }

  const tid = world.turnStateId | 0;
  if (!tid) return;
  const ts = world.get(tid, TurnState);
  if (!ts) return;

  // We run late in the frame: flip phase after actions resolve
  if (ts.phase === 'player'){
    if (actionThisFrame){
      try{ world.set(tid, TurnState, { phase: 'monsters' }); }catch(_){ /* deferred */ }
      actionThisFrame = false;
    }
  } else if (ts.phase === 'monsters'){
    // Let monster AI/movement run this frame, then go back to player and advance round
    try{ world.set(tid, TurnState, { phase: 'player', round: (ts.round|0) + 1 }); }catch(_){ /* deferred */ }
    actionThisFrame = false;
  }
}

export default turnSystem;
