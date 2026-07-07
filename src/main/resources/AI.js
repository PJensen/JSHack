import { defineExtension } from "../../lib/ecs-js/index.js";
import { completeOpenAICompatibleChat } from "../../cloud/llm/openAICompatible.js";
import { AIResource } from "../../rules/resources/AI.js";
import { readAISettings } from "../../shared/aiSettings.js";

function createAIResource() {
  return Object.freeze({
    experimental: true,

    /**
     * Experimental AI text completion. AI output is flavor text only; it must
     * never become canonical simulation state.
     *
     * @param {{ messages: Array<{ role: string, content: string }>, temperature?: number, maxTokens?: number }} opts
     * @returns {Promise<string|null>}
     */
    async complete(opts = {}) {
      const settings = readAISettings();
      if (settings.enabled !== true) return null;
      return await completeOpenAICompatibleChat({
        endpoint: settings.endpoint,
        apiKey: settings.apiKey,
        model: settings.model,
        messages: opts.messages,
        temperature: opts.temperature,
        maxTokens: opts.maxTokens,
      });
    },
  });
}

export const experimentalAIExtension = defineExtension(
  "jshack:experimental:ai",
  (world) => {
    world.setResource(AIResource, createAIResource());
  },
);
