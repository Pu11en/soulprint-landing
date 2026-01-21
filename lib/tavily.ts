import { tavily } from "@tavily/core";

// Initialize client
const getClient = () => {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) return null;
    return tavily({ apiKey });
};

export interface SearchOptions {
    maxResults?: number;
    includeAnswer?: boolean;
    searchDepth?: "basic" | "advanced";
    includeImages?: boolean;
    includeRawContent?: boolean;
    includeDomains?: string[];
    excludeDomains?: string[];
}

export async function searchWeb(query: string, options: SearchOptions = {}) {
    const client = getClient();
    if (!client) {
        throw new Error("TAVILY_API_KEY not found in environment variables");
    }

    try {
        const response = await client.search(query, {
            searchDepth: options.searchDepth || "basic",
            maxResults: options.maxResults || 5,
            includeAnswer: options.includeAnswer || false,
            includeImages: options.includeImages || false,
            includeRawContent: options.includeRawContent ? "text" : undefined,
            includeDomains: options.includeDomains,
            excludeDomains: options.excludeDomains,
        });
        return response;
    } catch (error) {
        console.error("Tavily search error:", error);
        return { results: [], answer: "", query };
    }
}

export function formatResultsForLLM(searchResponse: any): string {
    if (!searchResponse) return "";

    let formatted = "";

    // Add direct answer if available
    if (searchResponse.answer) {
        formatted += `DIRECT ANSWER: ${searchResponse.answer}\n\n`;
    }

    // Add search results
    if (searchResponse.results && Array.isArray(searchResponse.results)) {
        formatted += "SEARCH RESULTS:\n";
        searchResponse.results.forEach((result: any, i: number) => {
            formatted += `[${i + 1}] ${result.title}\n`;
            formatted += `    Source: ${result.url}\n`;
            formatted += `    Content: ${result.content.substring(0, 300)}...\n\n`;
        });
    }

    return formatted;
}
