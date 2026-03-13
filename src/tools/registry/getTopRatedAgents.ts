import { z } from "zod";
import { ToolResult } from "../types";
import {
    createRegistryControllers,
    fetchAgentCollectionId,
    fetchAgentNfts,
    fetchReputationScores,
    type AgentNftItem,
} from "./registryHelpers";

/**
 * Returns a list of agents with the highest reputation scores.
 * Fetches agent NFTs from the Identity Registry collection and queries reputation from the Reputation Registry.
 */
export async function getTopRatedAgents(
    _category: string,
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

        const items = await fetchAgentNfts<AgentNftItem>(config.apiUrl, collectionId, { size: 50 });
        const scoreMap = await fetchReputationScores(items, reputationController, reputationAddress);

        const agentRatings = items.map((item) => ({
            id: item.identifier,
            name: item.name,
            nonce: item.nonce,
            reputation_score: scoreMap.get(item.nonce) ?? 0,
            uri: item.url ?? "",
        }));

        const topAgents = agentRatings
            .sort((a, b) => b.reputation_score - a.reputation_score)
            .slice(0, limit);

        return {
            content: [{ type: "text", text: JSON.stringify(topAgents, null, 2) }]
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error fetching top rated agents: ${message}` }]
        };
    }
}

export const getTopRatedAgentsToolName = "get-top-rated-agents";
export const getTopRatedAgentsToolDescription = "Get the highest rated agents from the registry";
export const getTopRatedAgentsParamScheme = {
    category: z.string().optional().default("all").describe("Agent category (reserved for future use)"),
    limit: z.number().optional().default(5).describe("Maximum number of agents to return"),
};
