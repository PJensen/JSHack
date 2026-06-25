export const RuleResult = Object.freeze({
  handled(payload = {}) {
    return Object.freeze({ handled: true, ...payload });
  },

  unhandled(payload = {}) {
    return Object.freeze({ handled: false, ...payload });
  },
});
