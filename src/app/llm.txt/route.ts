import { buildLlmsTxt, llmsTxtResponse } from "@/lib/llms-txt";

export const dynamic = "force-static";

/** Alias of /llms.txt for agents that probe /llm.txt. */
export function GET() {
  return llmsTxtResponse(buildLlmsTxt());
}
