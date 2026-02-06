import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig, createEntrypoint } from "../networkConfig";
import { Abi, Address } from "@multiversx/sdk-core";
import identityAbiJson from "../../abis/identity-registry.abi.json";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";

/**
 * Agent details structure matching the ABI
 */
interface AgentDetails {
    name: string;
    uri: string;
    public_key: string;
    owner: Address;
    metadata: Array<{ key: string; value: string }>;
}

/**
 * Fetches the ARF (Agent Registration File) manifest for a given Agent ID (nonce).
 */
export async function getAgentManifest(agentNonce: number): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = Abi.create(identityAbiJson);
    const controller = entrypoint.createSmartContractController(abi);

    try {
        const results = await controller.query({
            contract: Address.newFromBech32(REGISTRY_ADDRESSES.IDENTITY),
            function: "get_agent",
            arguments: [agentNonce],
        });

        if (!results || results.length === 0) {
            return {
                content: [{ type: "text", text: `Agent #${agentNonce} not found.` }]
            };
        }

        const agentDetails = results[0] as AgentDetails;

        // Resolve internal manifest if URI is a data URI
        let manifest: any = {
            name: agentDetails.name,
            uri: agentDetails.uri,
            public_key: agentDetails.public_key,
            owner: agentDetails.owner.toBech32(),
            metadata: agentDetails.metadata.reduce((acc, curr) => ({ ...acc, [curr.key]: curr.value }), {})
        };

        if (agentDetails.uri.startsWith("data:application/json;base64,")) {
            try {
                const base64Data = agentDetails.uri.replace("data:application/json;base64,", "");
                const jsonStr = Buffer.from(base64Data, "base64").toString("utf-8");
                const arfData = JSON.parse(jsonStr);
                manifest = { ...manifest, ...arfData };
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
