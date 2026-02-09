import { z } from "zod";
import axios from "axios";
import { ToolResult } from "../types";
import { loadNetworkConfig, createEntrypoint } from "../networkConfig";
import { Address } from "@multiversx/sdk-core";
import { createPatchedAbi } from "../../utils/patchAbi";
import identityAbiJson from "../../abis/identity-registry.abi.json";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";

/**
 * Fetches the ARF (Agent Registration File) manifest for a given Agent ID (nonce).
 *
 * Combines data from multiple on-chain views:
 * - get_agent(nonce)        → AgentDetails { name, public_key }
 * - get_agent_owner(nonce)  → Address
 * - get_agent_metadata(nonce) → [[key, value], ...]
 * - NFT API query           → URI from the NFT's URIs array
 */
export async function getAgentManifest(agentNonce: number): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = createPatchedAbi(identityAbiJson);
    const controller = entrypoint.createSmartContractController(abi);
    const contractAddress = Address.newFromBech32(REGISTRY_ADDRESSES.IDENTITY);

    try {
        // 1. Fetch core agent details (name, public_key)
        const detailsResults = await controller.query({
            contract: contractAddress,
            function: "get_agent",
            arguments: [agentNonce],
        });

        if (!detailsResults || detailsResults.length === 0) {
            return {
                content: [{ type: "text", text: `Agent #${agentNonce} not found.` }]
            };
        }

        const details = detailsResults[0] as { name: string | Buffer; public_key: string | Buffer };
        const name = typeof details.name === "string" ? details.name : details.name.toString("utf-8");
        const publicKey = typeof details.public_key === "string"
            ? details.public_key
            : Buffer.from(details.public_key).toString("hex");

        // 2. Fetch owner address
        let ownerBech32 = "unknown";
        try {
            const ownerResults = await controller.query({
                contract: contractAddress,
                function: "get_agent_owner",
                arguments: [agentNonce],
            });
            if (ownerResults && ownerResults.length > 0) {
                const ownerAddr = ownerResults[0] as Address;
                ownerBech32 = ownerAddr.toBech32();
            }
        } catch {
            // Owner lookup failed — non-fatal
        }

        // 3. Fetch all metadata key-value pairs
        const metadata: Record<string, string> = {};
        try {
            const metadataResults = await controller.query({
                contract: contractAddress,
                function: "get_agent_metadata",
                arguments: [agentNonce],
            });
            if (metadataResults && metadataResults.length > 0) {
                // get_agent_metadata returns variadic<multi<bytes,bytes>>
                // Each result pair is [key, value]
                for (let i = 0; i < metadataResults.length; i += 2) {
                    const key = metadataResults[i];
                    const value = metadataResults[i + 1];
                    const keyStr = typeof key === "string" ? key : Buffer.from(key as Buffer).toString("utf-8");
                    const valStr = typeof value === "string" ? value : Buffer.from(value as Buffer).toString("utf-8");
                    metadata[keyStr] = valStr;
                }
            }
        } catch {
            // Metadata lookup failed — non-fatal
        }

        // 4. Fetch URI from NFT data via API (if available)
        let uri = "";
        try {
            const tokenIdResults = await controller.query({
                contract: contractAddress,
                function: "get_agent_token_id",
                arguments: [],
            });
            if (tokenIdResults && tokenIdResults.length > 0) {
                const tokenId = tokenIdResults[0] as string;
                const nftIdentifier = `${tokenId}-${agentNonce.toString(16).padStart(4, "0")}`;
                const nftUrl = `${config.apiUrl}/nfts/${nftIdentifier}`;
                const nftResponse = await axios.get(nftUrl, { timeout: 5000 }).catch(() => null);
                if (nftResponse && nftResponse.data?.uris?.length > 0) {
                    uri = Buffer.from(nftResponse.data.uris[0], "base64").toString("utf-8");
                } else if (nftResponse && nftResponse.data?.url) {
                    uri = nftResponse.data.url;
                }
            }
        } catch {
            // NFT/URI lookup failed — non-fatal
        }

        // 5. Compose manifest
        const manifest: Record<string, unknown> = {
            name,
            public_key: publicKey,
            owner: ownerBech32,
            ...(uri ? { uri } : {}),
            ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
        };

        // If URI is a data URI with embedded JSON, expand it into the manifest
        if (uri.startsWith("data:application/json;base64,")) {
            try {
                const base64Data = uri.replace("data:application/json;base64,", "");
                const jsonStr = Buffer.from(base64Data, "base64").toString("utf-8");
                const arfData = JSON.parse(jsonStr);
                Object.assign(manifest, arfData);
            } catch {
                // Ignore parsing errors
            }
        }

        return {
            content: [{ type: "text", text: JSON.stringify(manifest, null, 2) }]
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error fetching agent manifest: ${message}` }]
        };
    }
}

export const getAgentManifestToolName = "get-agent-manifest";
export const getAgentManifestToolDescription = "Fetch the Agent Registration File (ARF) manifest";
export const getAgentManifestParamScheme = {
    agentNonce: z.number().describe("The Agent ID (NFT Nonce)"),
};
