import { tavily } from "@tavily/core";

import { env } from "../env";

type SearchWebParams = {
  query: string;
  companyName: string;
  industry: string;
  maxResults?: number;
};

type SearchWebResult = {
  answer: string | null;
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
  }>;
};

export function isWebResearchAvailable(): boolean {
  return Boolean(env.TAVILY_API_KEY);
}

export async function searchWeb(params: SearchWebParams): Promise<SearchWebResult> {
  if (!env.TAVILY_API_KEY) {
    throw new Error("Web research is not configured — set TAVILY_API_KEY");
  }

  const client = tavily({ apiKey: env.TAVILY_API_KEY });

  // Prepend company name for context unless the query already mentions it
  const query = params.query.toLowerCase().includes(params.companyName.toLowerCase())
    ? params.query
    : `${params.companyName} ${params.query}`;

  try {
    const response = await client.search(query, {
      maxResults: params.maxResults ?? 5,
      searchDepth: "basic",
      includeAnswer: true,
    });

    return {
      answer: response.answer ?? null,
      results: (response.results ?? []).map((r) => ({
        title: r.title ?? "",
        url: r.url,
        content: r.content,
        score: r.score ?? 0,
      })),
    };
  } catch (error) {
    console.error("[web-research] Tavily search failed:", error);
    return { answer: null, results: [] };
  }
}
