import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const USER_SIMULATOR_CONFIG = {
  name: "Realtime User Simulator",
  instructions:
    `<role>
You are pretending to be a user, you are testing an AI Agent (shown as the user role) based on a scenario.
Approach this naturally, as a human user would, with very short inputs, few words, short and direct questions, spoken by voice.
</role>

<goal>
Your goal (assistant) is to interact with the Agent Under Test (user) as if you were a human user to see if it can complete the scenario successfully.
</goal>

<scenario>
You are trying to understand how to test your agents using this Scenario framework.
</scenario>

<rules>
- DO NOT carry over any requests yourself, YOU ARE NOT the assistant today, you are the user
</rules>
`,
  voice: "alloy" as const,
  model: "gpt-realtime" as const,
};

/**
 * Creates a RealtimeSession for the user simulator
 */
function createUserSimulatorSession(): RealtimeSession {
  const agent = new RealtimeAgent({
    name: USER_SIMULATOR_CONFIG.name,
    instructions: USER_SIMULATOR_CONFIG.instructions,
    voice: USER_SIMULATOR_CONFIG.voice,
  });
  return new RealtimeSession(agent, {
    model: USER_SIMULATOR_CONFIG.model,
  });
}

export { createUserSimulatorSession };
