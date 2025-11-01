// app/bridgeEvents.js
// Subscribes to rules-side semantic events and remaps them to display signals.
// Usage: bridgeEvents(world, (type, payload)=>{ /* forward to display */ })

export function bridgeEvents(world, emitDisplay) {
  const send = (type, payload) => { try { emitDisplay && emitDisplay(type, payload); } catch {} };

  const subs = [];
  subs.push(world.on('item:pickup', ({ actor, itemId, count, stackedIntoId }) => {
    send('display:toast', { text: `Picked up x${count}` });
  }));
  subs.push(world.on('item:pickup-denied', ({ reason }) => {
    const msg = reason === 'weight' ? 'Too heavy' : reason === 'capacity' ? 'No space' : 'Cannot pick up';
    send('display:toast', { text: msg });
  }));
  subs.push(world.on('item:dropped', ({ count }) => {
    send('display:toast', { text: `Dropped x${count}` });
  }));

  return () => { // unsubscribe
    for (const off of subs) try { off(); } catch {}
  };
}
