import { getAgentManifest } from "../getAgentManifest";
import { Address } from "@multiversx/sdk-core";

// Mock network config — define mock inline (jest.mock is hoisted above imports)
const mockQuery = jest.fn();

jest.mock("../../networkConfig", () => ({
    loadNetworkConfig: jest.fn().mockReturnValue({ apiUrl: "https://devnet-api.multiversx.com", chainId: "D" }),
    createEntrypoint: jest.fn().mockImplementation(() => ({
        createSmartContractController: jest.fn().mockReturnValue({
            query: mockQuery
        })
    }))
}));

jest.mock("axios", () => ({
    default: { get: jest.fn().mockResolvedValue({ data: { uris: [] } }) },
    get: jest.fn().mockResolvedValue({ data: { uris: [] } }),
}));

describe("getAgentManifest", () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    it("should fetch agent manifest using multiple ABI queries", async () => {
        // The function makes up to 4 queries:
        // 1. get_agent → { name, public_key }
        // 2. get_agent_owner → Address
        // 3. get_agent_metadata → [key, value, key, value, ...]
        // 4. get_agent_token_id → tokenId (for NFT URI lookup)
        mockQuery
            .mockResolvedValueOnce([{ name: "DeFi Bot", public_key: Buffer.from("test-pk") }])
            .mockResolvedValueOnce([Address.newFromBech32("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu")])
            .mockResolvedValueOnce(["category", "defi", "version", "1.0"])
            .mockResolvedValueOnce(["AGENT-abc123"]);

        const result = await getAgentManifest(1);

        expect(result.content[0].type).toBe("text");
        const manifest = JSON.parse(result.content[0].text);
        expect(manifest.name).toBe("DeFi Bot");
        expect(manifest.owner).toBe("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu");
        expect(manifest.metadata).toEqual({ category: "defi", version: "1.0" });
    });

    it("should handle missing agents gracefully", async () => {
        mockQuery.mockResolvedValueOnce([]);

        const result = await getAgentManifest(999);
        expect(result.content[0].text).toContain("not found");
    });

    it("should handle query errors gracefully", async () => {
        mockQuery.mockRejectedValueOnce(new Error("Contract error"));

        const result = await getAgentManifest(999);
        expect(result.content[0].text).toContain("Error fetching agent manifest");
    });

    it("should return partial data when secondary queries fail", async () => {
        // get_agent succeeds, others fail
        mockQuery
            .mockResolvedValueOnce([{ name: "Partial Bot", public_key: Buffer.from("pk") }])
            .mockRejectedValueOnce(new Error("Owner lookup failed"))
            .mockRejectedValueOnce(new Error("Metadata lookup failed"))
            .mockRejectedValueOnce(new Error("Token ID lookup failed"));

        const result = await getAgentManifest(1);
        const manifest = JSON.parse(result.content[0].text);
        expect(manifest.name).toBe("Partial Bot");
        expect(manifest.owner).toBe("unknown");
    });
});
