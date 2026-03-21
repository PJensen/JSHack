import { defineComponent } from "../../lib/ecs-js/index.js";

/**
 * Links centipede segments into a doubly-linked chain.
 * Head has headId=0 and index=0.  Body segments point back to
 * the head and carry their position in the chain.
 */
export const CentipedeSegment = defineComponent("CentipedeSegment", {
  headId:  0,   // entity ID of the chain head (0 = self is head)
  index:   0,   // position in chain: 0 = head
  nextId:  0,   // next segment toward tail (0 = this is the tail)
  prevId:  0,   // previous segment toward head (0 = this is the head)
  chainId: 0,   // unique chain identifier for fast same-chain queries
});
