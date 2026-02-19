import { RealtimeAgent, RealtimeSession } from "@openai/agents/realtime";

const AGENT_INSTRUCTIONS = `You are an expert on LangWatch's Scenario testing framework. You help developers understand simulation-based testing for AI agents.

You know that:
- Scenario enables 3 levels of agent quality: Unit tests, Evals/Prompt optimization, and Agent Simulations
- Framework-agnostic: works with LangGraph, CrewAI, Pydantic AI, etc.
- Simulation-based testing for real agent behavior in different scenarios and edge cases
- Multi-turn control and evaluation at any point in conversations
- Available in Python, TypeScript, and Go
- Simple integration via one call() method, no dataset required

Style:
- This is a VOICE conversation. Keep every response to 2-3 sentences max.
- Be concise and direct. Answer the specific question asked, don't dump all information at once.
- Speak naturally and conversationally.
`;

/**
 * Agent configuration
 */
const AGENT_CONFIG = {
  name: "Scenario Expert",
  instructions: AGENT_INSTRUCTIONS,
  voice: "ash" as const,
  model: "gpt-realtime" as const,
} as const;

/**
 * Creates the Scenario Expert agent instance
 */
function createScenarioExpertAgent(): RealtimeAgent {
  return new RealtimeAgent({
    name: AGENT_CONFIG.name,
    instructions: AGENT_CONFIG.instructions,
    voice: AGENT_CONFIG.voice,
  });
}

/**
 * Creates a RealtimeSession coupled with Scenario Expert agent
 *
 * This is the unified way to create a session for both browser and test environments.
 * After creating the session, connect it with either:
 * - Browser: ephemeral token from token server
 * - Tests: API key directly
 *
 * @example
 * ```typescript
 * // Browser
 * const session = createScenarioExpertSession();
 * await session.connect({ apiKey: ephemeralToken });
 *
 * // Tests
 * const session = createScenarioExpertSession();
 * await session.connect({ apiKey: process.env.OPENAI_API_KEY });
 * const adapter = new RealtimeAgentAdapter({ session, role: AgentRole.AGENT, agentName: "..." });
 * ```
 */
export function createScenarioExpertSession(): RealtimeSession {
  const agent = createScenarioExpertAgent();
  return new RealtimeSession(agent, {
    model: AGENT_CONFIG.model,
  });
}
