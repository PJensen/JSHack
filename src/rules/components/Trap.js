
export const Trap = defineComponent(
    "Trap",
    {
        type: "", // logical category, e.g. s"poison", "fire", "spike"
        description: "", // flavor text description of the trap
        damageFunction: null, // function(context, entity) => { ... } - called when trap is triggered        
    },
    {
        validate(rec) {
            if (typeof rec.type !== "string")
                throw new Error("Trap.validate(): type must be a string");
            if (typeof rec.damage !== "object" && rec.damage !== null)
                throw new Error("Trap.validate(): damage must be an object or null");
            if (typeof rec.description !== "string")
                throw new Error("Trap.validate(): description must be a string");
            return true;
        },
    }
);