/**
 * Shared helpers for Identity and Reputation Registry operations.
 */

import axios from "axios";
import { Address } from "@multiversx/sdk-core";
import { loadNetworkConfig, createEntrypoint } from "../networkConfig";
import { REGISTRY_ADDRESSES } from "../../utils/registryConfig";
import { createPatchedAbi } from "../../utils/patchAbi";
import identityAbiJson from "../../abis/identity-registry.abi.json";
import reputationAbiJson from "../../abis/reputation-registry.abi.json";

export interface AgentNftItem {
    identifier: string;
    name: string;
    nonce: number;
    url?: string;
    owner?: string;
    collection?: string;
    timestamp?: number;
}

export interface RegistryControllers {
    identityController: ReturnType<ReturnType<typeof createEntrypoint>["createSmartContractController"]>;
    reputationController: ReturnType<ReturnType<typeof createEntrypoint>["createSmartContractController"]>;
    identityAddress: Address;
    reputationAddress: Address;
    config: ReturnType<typeof loadNetworkConfig>;
}

/**
 * Create Identity and Reputation registry controllers.
 */
export function createRegistryControllers(): RegistryControllers {
    const config = loadNetworkConfig();
    const entrypoint = createEntrypoint(config);
    const identityAbi = createPatchedAbi(identityAbiJson);
    const reputationAbi = createPatchedAbi(reputationAbiJson);
    return {
        identityController: entrypoint.createSmartContractController(identityAbi),
        reputationController: entrypoint.createSmartContractController(reputationAbi),
        identityAddress: Address.newFromBech32(REGISTRY_ADDRESSES.IDENTITY),
        reputationAddress: Address.newFromBech32(REGISTRY_ADDRESSES.REPUTATION),
        config,
    };
}

/**
 * Fetch agent collection ID from Identity Registry.
 */
export async function fetchAgentCollectionId(
    identityController: RegistryControllers["identityController"],
    identityAddress: Address
): Promise<string> {
    const tokenIdResults = await identityController.query({
        contract: identityAddress,
        function: "get_agent_token_id",
        arguments: [],
    });
    const tokenId = tokenIdResults?.[0];
    const collectionId = typeof tokenId === "string" ? tokenId : (tokenId ? Buffer.from(tokenId as Buffer).toString("utf-8") : "");
    return collectionId;
}

/**
 * Fetch reputation scores for multiple agents in parallel.
 */
export async function fetchReputationScores(
    items: AgentNftItem[],
    reputationController: RegistryControllers["reputationController"],
    reputationAddress: Address
): Promise<Map<number, number>> {
    const results = await Promise.all(
        items.map(async (item) => {
            try {
                const scoreResults = await reputationController.query({
                    contract: reputationAddress,
                    function: "get_reputation_score",
                    arguments: [BigInt(item.nonce)],
                });
                const score = Number(scoreResults?.[0]?.valueOf?.() ?? 0);
                return { nonce: item.nonce, score } as const;
            } catch {
                return { nonce: item.nonce, score: 0 } as const;
            }
        })
    );
    return new Map(results.map((r) => [r.nonce, r.score]));
}

/**
 * Fetch agent NFTs from the API by collection and optional search.
 */
export async function fetchAgentNfts<T extends AgentNftItem>(
    apiUrl: string,
    collectionId: string,
    options: { search?: string; size?: number } = {}
): Promise<T[]> {
    const params: Record<string, string | number> = {
        collection: collectionId,
        size: options.size ?? 50,
        type: "NonFungibleESDT",
    };
    if (options.search) {
        params.search = options.search;
    }
    const response = await axios.get<T[]>(`${apiUrl}/nfts`, { params, timeout: 10000 });
    return Array.isArray(response.data) ? response.data : [];
}
