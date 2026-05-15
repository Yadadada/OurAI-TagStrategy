// Stub for AgentClient (api/src/services/AgentClient.ts).
// personaCard.ts uses it as a fallback when the direct Dashscope call fails.
// In coursework we don't have an LLM available; the call always throws so the
// production code falls back to preset summaries (degraded=true).

export interface ChatCompletionRequest {
  messages: Array<{ role: string; content: string }>;
  model_id?: string;
  user_id?: string;
}

export interface ChatCompletionResult {
  content: string;
}

class StubAgentClient {
  async chatCompletion(_req: ChatCompletionRequest): Promise<ChatCompletionResult> {
    throw new Error('LLM not available in coursework environment — falling back to preset persona text.');
  }
}

let singleton: StubAgentClient | null = null;

export function getAgentClient(): StubAgentClient {
  if (!singleton) singleton = new StubAgentClient();
  return singleton;
}
