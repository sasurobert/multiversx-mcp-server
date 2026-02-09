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

describe("getAgentManifest", () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    it("should fetch agent manifest using ABI", async () => {
        const mockAgentDetails = {
            name: "DeFi Bot",
            uri: "ipfs://QmTest",
            public_key: "test-pk",
            owner: Address.newFromBech32("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
            metadata: []
        };

        mockQuery.mockResolvedValue([mockAgentDetails]);

        const result = await getAgentManifest(1);

        expect(result.content[0].type).toBe("text");
        const manifest = JSON.parse(result.content[0].text);
        expect(manifest.name).toBe("DeFi Bot");
        expect(manifest.uri).toBe("ipfs://QmTest");
    });

    it("should handle missing agents", async () => {
        mockQuery.mockRejectedValue(new Error("Agent not found"));

        const result = await getAgentManifest(999);
        expect(result.content[0].text).toContain("Error fetching agent manifest");
    });
});
