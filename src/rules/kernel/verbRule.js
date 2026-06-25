import { executeInteraction } from "../interaction/runtime/actionRuntime.js";
import { RuleResult } from "./RuleResult.js";

export function defineVerbRule(definition) {
  const id = String(definition?.id || "");
  const verb = String(definition?.verb || "");
  if (!id) throw new Error("defineVerbRule requires an id");
  if (!verb) throw new Error(`verb rule "${id}" requires a verb`);
  if (typeof definition.apply !== "function") {
    throw new Error(`verb rule "${id}" requires apply(ctx)`);
  }
  return Object.freeze({
    id,
    verb,
    priority: Number(definition.priority || 0),
    when: typeof definition.when === "function" ? definition.when : null,
    otherwise: typeof definition.otherwise === "function" ? definition.otherwise : null,
    apply: definition.apply,
  });
}

export function executeVerbRule(world, rule, spec) {
  return executeInteraction(world, {
    verb: rule.verb,
    actor: spec.actor,
    primary: spec.primary,
    target: spec.target,
    params: {
      ...(spec.params || {}),
      ruleId: rule.id,
    },
    pipeline(ctx) {
      ctx.trace.rule(rule.id);
      if (rule.when && rule.when(ctx) !== true) {
        ctx.trace.rejected(rule.id, "when");
        const result = rule.otherwise
          ? (rule.otherwise(ctx) || RuleResult.unhandled({ ruleId: rule.id }))
          : RuleResult.unhandled({ ruleId: rule.id });
        return {
          payload: result,
          metrics: { handled: result.handled === true, ruleId: rule.id },
        };
      }
      const result = rule.apply(ctx) || RuleResult.handled();
      return {
        payload: result,
        metrics: {
          handled: result.handled === true,
          ruleId: rule.id,
          outcomeId: String(result.outcomeId || ""),
        },
      };
    },
  });
}
