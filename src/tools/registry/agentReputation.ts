import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig, createNetworkProvider } from "../networkConfig";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";
import { Address, AbiRegistry, SmartContractQuery, ArgSerializer, SmartContractTransactionsFactory, TransactionsFactoryConfig, NativeSerializer } from "@multiversx/sdk-core";
import fs from "fs";
import path from "path";

let reputationAbi: AbiRegistry | undefined;

function initializeReputationAbi() {
    if (reputationAbi) return;
    const abiPath = path.join(__dirname, "../../abis/reputation-registry.abi.json");
    reputationAbi = AbiRegistry.create(JSON.parse(fs.readFileSync(abiPath, "utf8")));
}

/**
 * Fetch reputation score and total jobs for an agent.
 */
export async function getAgentReputation(agentNonce: number): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const provider = createNetworkProvider(config);
    initializeReputationAbi();

    try {
        const serializer = new ArgSerializer();
        const scoreEndpoint = reputationAbi!.getEndpoint("getReputationScore");
        const totalJobsEndpoint = reputationAbi!.getEndpoint("getTotalJobs");

        const scoreQuery = new SmartContractQuery({
            contract: Address.newFromBech32(REGISTRY_ADDRESSES.REPUTATION),
            function: "getReputationScore",
            arguments: serializer.valuesToBuffers(NativeSerializer.nativeToTypedValues([BigInt(agentNonce)], scoreEndpoint))
        });

        const totalJobsQuery = new SmartContractQuery({
            contract: Address.newFromBech32(REGISTRY_ADDRESSES.REPUTATION),
            function: "getTotalJobs",
            arguments: serializer.valuesToBuffers(NativeSerializer.nativeToTypedValues([BigInt(agentNonce)], totalJobsEndpoint))
        });

        const [scoreRes, totalJobsRes] = await Promise.all([
            provider.queryContract(scoreQuery),
            provider.queryContract(totalJobsQuery)
        ]);

        const scoreValues = serializer.buffersToValues(scoreRes.returnDataParts.map(p => Buffer.from(p)), scoreEndpoint.output);
        const totalJobsValues = serializer.buffersToValues(totalJobsRes.returnDataParts.map(p => Buffer.from(p)), totalJobsEndpoint.output);

        const score = scoreValues[0]?.valueOf().toString() || "0";
        const totalJobs = totalJobsValues[0]?.valueOf().toString() || "0";

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
 */
export async function submitAgentFeedback(agentNonce: number, rating: number, sender?: string): Promise<ToolResult> {
    const config = loadNetworkConfig();
    initializeReputationAbi();

    try {
        const senderAddress = sender ? Address.newFromBech32(sender) : new Address(Buffer.alloc(32));

        const factory = new SmartContractTransactionsFactory({
            abi: reputationAbi!,
            config: new TransactionsFactoryConfig({ chainID: config.chainId })
        });

        const endpoint = reputationAbi!.getEndpoint("submit_feedback");
        const typedArgs = NativeSerializer.nativeToTypedValues([
            BigInt(agentNonce),
            BigInt(rating)
        ], endpoint);

        const tx = await factory.createTransactionForExecute(
            senderAddress,
            {
                contract: Address.newFromBech32(REGISTRY_ADDRESSES.REPUTATION),
                function: "submit_feedback",
                arguments: typedArgs,
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
    sender: z.string().optional().describe("The address of the feedback submitter (Employer)"),
};
