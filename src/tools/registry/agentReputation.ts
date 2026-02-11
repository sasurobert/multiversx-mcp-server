import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig, createEntrypoint } from "../networkConfig";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";
import { Address } from "@multiversx/sdk-core";
import { createPatchedAbi } from "../../utils/patchAbi";
import reputationAbiJson from "../../abis/reputation-registry.abi.json";

/**
 * Fetch reputation score and total jobs for an agent.
 * Uses the Entrypoint + SmartContractController pattern for consistent querying.
 */
export async function getAgentReputation(agentNonce: number): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = createPatchedAbi(reputationAbiJson);
    const controller = entrypoint.createSmartContractController(abi);

    try {
        const contractAddress = Address.newFromBech32(REGISTRY_ADDRESSES.REPUTATION);

        const [scoreResults, totalJobsResults] = await Promise.all([
            controller.query({
                contract: contractAddress,
                function: "get_reputation_score",
                arguments: [BigInt(agentNonce)],
            }),
            controller.query({
                contract: contractAddress,
                function: "get_total_jobs",
                arguments: [BigInt(agentNonce)],
            }),
        ]);

        const score = scoreResults[0]?.valueOf()?.toString() || "0";
        const totalJobs = totalJobsResults[0]?.valueOf()?.toString() || "0";

        const result = {
            agent_id: agentNonce,
            reputation_score: score,
            total_completed_jobs: totalJobs,
            last_sync: new Date().toISOString()
        };

        return {
            content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error fetching reputation: ${message}` }],
            isError: true
        };
    }
}

/**
 * Build a transaction to submit feedback for an agent.
 * ABI signature: giveFeedbackSimple(job_id: bytes, agent_nonce: u64, rating: BigUint)
 */
export async function submitAgentFeedback(
    agentNonce: number,
    rating: number,
    jobId: string,
    sender?: string,
): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = createPatchedAbi(reputationAbiJson);
    const factory = entrypoint.createSmartContractTransactionsFactory(abi);

    try {
        const senderAddress = sender ? Address.newFromBech32(sender) : new Address(Buffer.alloc(32));

        const tx = await factory.createTransactionForExecute(
            senderAddress,
            {
                contract: Address.newFromBech32(REGISTRY_ADDRESSES.REPUTATION),
                function: "giveFeedbackSimple",
                arguments: [
                    Buffer.from(jobId),
                    BigInt(agentNonce),
                    BigInt(rating),
                ],
                gasLimit: 10_000_000n
            }
        );

        return {
            content: [{ type: "text", text: JSON.stringify(tx.toPlainObject(), null, 2) }]
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error creating feedback transaction: ${message}` }],
            isError: true
        };
    }
}

export const getAgentReputationToolName = "get-agent-reputation";
export const getAgentReputationToolDescription = "Get the reputation score and total jobs count for an agent";
export const getAgentReputationParamScheme = {
    agentNonce: z.number().describe("The Agent ID (NFT Nonce)"),
};

export const submitAgentFeedbackToolName = "submit-agent-feedback";
export const submitAgentFeedbackToolDescription = "Create an unsigned transaction to submit feedback/rating for an agent";
export const submitAgentFeedbackParamScheme = {
    agentNonce: z.number().describe("The Agent ID (NFT Nonce)"),
    rating: z.number().min(1).max(5).describe("Rating from 1 to 5"),
    jobId: z.string().describe("The Job ID associated with this feedback"),
    sender: z.string().optional().describe("The address of the feedback submitter (Employer)"),
};
