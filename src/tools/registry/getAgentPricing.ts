import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig, createEntrypoint } from "../networkConfig";
import { Address } from "@multiversx/sdk-core";
import { createPatchedAbi } from "../../utils/patchAbi";
import identityAbiJson from "../../abis/identity-registry.abi.json";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";

/**
 * Fetches the pricing details for a specific agent service.
 */
export async function getAgentPricing(agentNonce: number, serviceId: string): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = createPatchedAbi(identityAbiJson);
    const controller = entrypoint.createSmartContractController(abi);

    try {
        const configResults = await controller.query({
            contract: Address.newFromBech32(REGISTRY_ADDRESSES.IDENTITY),
            function: "get_agent_service_config",
            arguments: [agentNonce, Buffer.from(serviceId)],
        });

        if (!configResults || configResults.length === 0 || !configResults[0]) {
            return {
                content: [{ type: "text", text: `Pricing configuration not found for Agent #${agentNonce} service: ${serviceId}` }]
            };
        }

        interface ServiceConfig {
            price: { toString(): string };
            token: { identifier: { toString(): string } };
            pnonce: bigint | number;
        }

        const serviceConfig = configResults[0] as ServiceConfig;

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    agent_id: agentNonce,
                    service_id: serviceId,
                    price: serviceConfig.price.toString(),
                    token: serviceConfig.token?.identifier?.toString() ?? 'EGLD',
                    pnonce: Number(serviceConfig.pnonce ?? 0),
                }, null, 2)
            }]
        };

    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error fetching agent pricing: ${message}` }]
        };
    }
}

export const getAgentPricingToolName = "get-agent-pricing";
export const getAgentPricingToolDescription = "Fetch the specific pricing for an agent service";
export const getAgentPricingParamScheme = {
    agentNonce: z.number().describe("The Agent ID (NFT Nonce)"),
    serviceId: z.string().describe("The specific service identifier (e.g., 'chat', 'vision')"),
};
