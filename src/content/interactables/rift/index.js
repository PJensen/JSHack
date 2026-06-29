import { defineInteractable } from "../../index.js";
import { RiftPortal } from "../../../rules/components/RiftPortal.js";
import { RiftEnterRequested } from "../../../events/RiftEnterRequested.js";

defineInteractable("riftPortal", {
  affordance: {
    title: "Rift Portal",
    hint: "Tap to enter the rift",
    label: "Enter Rift",
  },
  onInteract(ctx) {
    const portal = ctx.world.get(ctx.targetId, RiftPortal);
    if (!portal?.riftId) {
      ctx.cancel("RIFT_PORTAL_INVALID", "The rift is unstable.");
      return;
    }
    ctx.world.emit(new RiftEnterRequested({
      actor: ctx.actor,
      portalId: ctx.targetId,
      riftId: portal.riftId,
    }));
  },
});
