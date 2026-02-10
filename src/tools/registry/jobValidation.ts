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
 * Build a transaction to request validation for a job (Agent Owner only).
 */
export async function validationRequest(
    jobId: string,
    validatorAddress: string,
    requestUri: string,
    requestHash: string,
    sender?: string
): Promise<ToolResult> {
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
                function: "validation_request",
                arguments: [
                    Buffer.from(jobId),
                    Address.newFromBech32(validatorAddress),
                    Buffer.from(requestUri),
                    Buffer.from(requestHash),
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
            content: [{ type: "text", text: `Error creating validation request transaction: ${message}` }],
            isError: true
        };
    }
}

/**
 * Build a transaction to respond to a validation request (Validator only).
 */
export async function validationResponse(
    requestHash: string,
    response: number,
    responseUri: string,
    responseHash: string,
    tag: string,
    sender?: string
): Promise<ToolResult> {
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
                function: "validation_response",
                arguments: [
                    Buffer.from(requestHash),
                    response,
                    Buffer.from(responseUri),
                    Buffer.from(responseHash),
                    Buffer.from(tag),
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
            content: [{ type: "text", text: `Error creating validation response transaction: ${message}` }],
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

export const validationRequestToolName = "validation-request";
export const validationRequestToolDescription = "Create an unsigned transaction to request validation from a validator (Agent Owner only, ERC-8004)";
export const validationRequestParamScheme = {
    jobId: z.string().describe("The Job ID to validate"),
    validatorAddress: z.string().describe("Bech32 address of the validator"),
    requestUri: z.string().describe("URI for the validation request details"),
    requestHash: z.string().describe("Hash of the validation request"),
    sender: z.string().optional().describe("The address of the Agent Owner"),
};

export const validationResponseToolName = "validation-response";
export const validationResponseToolDescription = "Create an unsigned transaction to respond to a validation request (Validator only, ERC-8004)";
export const validationResponseParamScheme = {
    requestHash: z.string().describe("Hash of the validation request to respond to"),
    response: z.number().min(0).max(100).describe("Validation score (0-100)"),
    responseUri: z.string().describe("URI for the validation response details"),
    responseHash: z.string().describe("Hash of the validation response"),
    tag: z.string().describe("Tag for the validation response"),
    sender: z.string().optional().describe("The address of the Validator"),
};

