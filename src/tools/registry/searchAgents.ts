import { z } from "zod";
import { ToolResult } from "../types";
import {
    createRegistryControllers,
    fetchAgentCollectionId,
    fetchAgentNfts,
    fetchReputationScores,
    type AgentNftItem,
} from "./registryHelpers";

interface SearchNftItem extends AgentNftItem {
    owner: string;
    collection: string;
    timestamp: number;
}

/**
 * Searches for agents based on a query string.
 * Fetches agent NFTs from the Identity Registry collection and reputation from the Reputation Registry.
 */
export async function searchAgents(
    query: string,
    minTrust?: number,
    limit: number = 5
): Promise<ToolResult> {
    const { identityController, reputationController, identityAddress, reputationAddress, config } = createRegistryControllers();

    try {
        const collectionId = await fetchAgentCollectionId(identityController, identityAddress);
        if (!collectionId) {
            return {
                content: [{ type: "text", text: "Could not fetch agent token ID from Identity Registry." }]
            };
        }

        const items = await fetchAgentNfts<SearchNftItem>(config.apiUrl, collectionId, {
            search: query,
            size: Math.min(limit * 3, 30),
        });
        const scoreMap = await fetchReputationScores(items, reputationController, reputationAddress);

        const agents = [];
        for (const item of items) {
            const reputation_score = scoreMap.get(item.nonce) ?? 0;
            if (minTrust !== undefined && reputation_score < minTrust) {
                continue;
            }
            agents.push({
                id: item.identifier,
                name: item.name,
                nonce: item.nonce,
                owner: item.owner,
                uri: item.url ?? "",
                collection: item.collection ?? "",
                timestamp: item.timestamp ?? 0,
                reputation_score,
            });
        }

        const result = agents.slice(0, limit);

        if (result.length === 0) {
            return {
                content: [{ type: "text", text: `No agents found matching query: "${query}"` }]
            };
        }

        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error searching for agents: ${message}` }]
        };
    }
}

export const searchAgentsToolName = "search-agents";
export const searchAgentsToolDescription = "Search for agents by name, capability, or keyword";
export const searchAgentsParamScheme = {
    query: z.string().describe("The search query (e.g., 'shopper', 'oracle', 'data collector')"),
    minTrust: z.number().optional().describe("Minimum reputation score (1-100)"),
    limit: z.number().optional().default(5).describe("Maximum number of agents to return"),
};
