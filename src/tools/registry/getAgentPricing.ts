import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig, createEntrypoint } from "../networkConfig";
import { Abi, Address } from "@multiversx/sdk-core";
import identityAbiJson from "../../abis/identity-registry.abi.json";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";

/**
 * Fetches the pricing details for a specific agent service.
 */
export async function getAgentPricing(agentNonce: number, serviceId: string): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const abi = Abi.create(identityAbiJson);
    const controller = entrypoint.createSmartContractController(abi);

    try {
        const priceResults = await controller.query({
            contract: Address.newFromBech32(REGISTRY_ADDRESSES.IDENTITY),
            function: "get_agent_service_price",
            arguments: [agentNonce, Buffer.from(serviceId)],
        });

        if (!priceResults || priceResults.length === 0) {
            return {
                content: [{ type: "text", text: `Pricing not found for Agent #${agentNonce} service: ${serviceId}` }]
            };
        }

        const price = priceResults[0] as bigint;

        return {
            content: [{
                type: "text",
                text: JSON.stringify({
                    agent_id: agentNonce,
                    service_id: serviceId,
                    price: price.toString(),
                    token: "EGLD", // Default for now, should be expanded to fetch token/nonce if available in ABI
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
