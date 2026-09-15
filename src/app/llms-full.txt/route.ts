import { buildLlmsFullTxt, llmsTxtResponse } from "@/lib/llms-txt";

export const dynamic = "force-static";

/** Longer CiteBrief context for agents that want more than /llms.txt. */
export function GET() {
  return llmsTxtResponse(buildLlmsFullTxt());
}
