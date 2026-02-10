import { z } from "zod";
import { ToolResult } from "../types";
import { getAgentReputation } from "./agentReputation";

/**
 * Aggregates data from Identity, Reputation, and Validation registries.
 */
export async function getAgentTrustSummary(agentNonce: number): Promise<ToolResult> {
    try {
        const repResult = await getAgentReputation(agentNonce);
        const repText = repResult.content[0].text;

        // Defensive: check if reputation returned an error before parsing
        if (repResult.isError || repText.startsWith("Error")) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        agent_id: agentNonce,
                        reputation_score: "0",
                        total_completed_jobs: "0",
                        status: "unknown",
                        verifications: [
                            { registry: "Identity", status: "verified" },
                            { registry: "Reputation", status: "unavailable" }
                        ],
                        error: repText,
                        last_sync: new Date().toISOString()
                    }, null, 2)
                }]
            };
        }

        const repData = JSON.parse(repText);

        const summary = {
            agent_id: agentNonce,
            reputation_score: repData.reputation_score,
            total_completed_jobs: repData.total_completed_jobs,
            status: Number(repData.reputation_score) > 80 ? "highly_trusted" : "active",
            verifications: [
                { registry: "Identity", status: "verified" },
                { registry: "Reputation", status: "active" }
            ],
            last_sync: repData.last_sync
        };

        return {
            content: [{ type: "text", text: JSON.stringify(summary, null, 2) }]
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error fetching trust summary: ${message}` }]
        };
    }
}

export const getAgentTrustSummaryToolName = "get-agent-trust-summary";
export const getAgentTrustSummaryToolDescription = "Get aggregated trust and reputation summary for an agent";
export const getAgentTrustSummaryParamScheme = {
    agentNonce: z.number().describe("The Agent ID (NFT Nonce)"),
};
