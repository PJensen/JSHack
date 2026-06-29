import { defineInteractable } from "../../index.js";
import { MailboxOpenRequested } from "../../../events/MailboxOpenRequested.js";

defineInteractable("openMailbox", {
  affordance: {
    title: "Mailbox",
    label: "Check mail",
    hint: "Send and receive town mail.",
  },
  onInteract(ctx) {
    const { world, actor, targetId } = ctx;
    world.emit?.(new MailboxOpenRequested({ actor, targetId }));
  },
});
