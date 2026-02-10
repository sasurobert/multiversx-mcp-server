import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig, createEntrypoint } from "../networkConfig";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";
import { Address } from "@multiversx/sdk-core";
import { createPatchedAbi } from "../../utils/patchAbi";
import validationAbiJson from "../../abis/validation-registry.abi.json";

/**
 * Check if a specific job has been verified on-chain.
 */
export async function isJobVerified(jobId: string): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = createPatchedAbi(validationAbiJson);
    const controller = entrypoint.createSmartContractController(abi);

    try {
        const results = await controller.query({
            contract: Address.newFromBech32(REGISTRY_ADDRESSES.VALIDATION),
            function: "is_job_verified",
            arguments: [Buffer.from(jobId)],
        });

        const isVerified = results[0]?.valueOf() === true;

        return {
            content: [{
                type: "text",
                text: JSON.stringify({ job_id: jobId, verified: isVerified }, null, 2)
            }]
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error checking job status: ${message}` }],
            isError: true
        };
    }
}

/**
 * Build a transaction to submit a proof for a job (Agent only).
 */
export async function submitJobProof(jobId: string, proofHash: string, sender?: string): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = createPatchedAbi(validationAbiJson);
    const factory = entrypoint.createSmartContractTransactionsFactory(abi);

    try {
        const senderAddress = sender ? Address.newFromBech32(sender) : new Address(Buffer.alloc(32));

        const tx = await factory.createTransactionForExecute(
            senderAddress,
            {
                contract: Address.newFromBech32(REGISTRY_ADDRESSES.VALIDATION),
                function: "submit_proof",
                arguments: [
                    Buffer.from(jobId),
                    Buffer.from(proofHash, "hex")
                ],
                gasLimit: 15_000_000n
            }
        );

        return {
            content: [{ type: "text", text: JSON.stringify(tx.toPlainObject(), null, 2) }]
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error creating proof transaction: ${message}` }],
            isError: true
        };
    }
}

/**
 * Build a transaction to verify a job (Oracle/Validator only).
 */
export async function verifyJob(jobId: string, sender?: string): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = createPatchedAbi(validationAbiJson);
    const factory = entrypoint.createSmartContractTransactionsFactory(abi);

    try {
        const senderAddress = sender ? Address.newFromBech32(sender) : new Address(Buffer.alloc(32));

        const tx = await factory.createTransactionForExecute(
            senderAddress,
            {
                contract: Address.newFromBech32(REGISTRY_ADDRESSES.VALIDATION),
                function: "verify_job",
                arguments: [
                    Buffer.from(jobId),
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
            content: [{ type: "text", text: `Error creating verify transaction: ${message}` }],
            isError: true
        };
    }
}

export const isJobVerifiedToolName = "is-job-verified";
export const isJobVerifiedToolDescription = "Check if a job ID has been cryptographically verified by an Oracle";
export const isJobVerifiedParamScheme = {
    jobId: z.string().describe("The unique Job ID to check"),
};

export const submitJobProofToolName = "submit-job-proof";
export const submitJobProofToolDescription = "Create an unsigned transaction to submit job proof (Agent only)";
export const submitJobProofParamScheme = {
    jobId: z.string().describe("The Job ID"),
    proofHash: z.string().describe("Hash of the result data to prove"),
    sender: z.string().optional().describe("The address of the Agent submitting the proof"),
};

export const verifyJobToolName = "verify-job";
export const verifyJobToolDescription = "Create an unsigned transaction to finalize job verification (Oracle only)";
export const verifyJobParamScheme = {
    jobId: z.string().describe("The Job ID to verify"),
    sender: z.string().optional().describe("The address of the Oracle/Validator"),
};
