import { buildLlmsTxt, llmsTxtResponse } from "@/lib/llms-txt";

export const dynamic = "force-static";

/** llmstxt.org curated map for AI agents / AI SEO. */
export function GET() {
  return llmsTxtResponse(buildLlmsTxt());
}
