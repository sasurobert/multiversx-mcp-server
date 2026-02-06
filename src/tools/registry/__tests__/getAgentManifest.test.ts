import { getAgentManifest } from "../getAgentManifest";
import { Address } from "@multiversx/sdk-core";

// Mock SDK components
jest.mock("@multiversx/sdk-core", () => {
    const original = jest.requireActual("@multiversx/sdk-core");
    return {
        ...original,
        DevnetEntrypoint: jest.fn().mockImplementation(() => ({
            createSmartContractController: jest.fn().mockImplementation(() => ({
                query: jest.fn()
            }))
        }))
    };
});

// Mock network config
jest.mock("../../networkConfig", () => ({
    loadNetworkConfig: jest.fn().mockReturnValue({ apiUrl: "https://devnet-api.multiversx.com", chainId: "D" }),
    createNetworkProvider: jest.fn() // Unused in ABI flow
}));

describe("getAgentManifest", () => {
    it("should fetch agent manifest using ABI", async () => {
        const mockAgentDetails = {
            name: "DeFi Bot",
            uri: "ipfs://QmTest",
            public_key: "test-pk",
            owner: Address.newFromBech32("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
            metadata: []
        };

        // We need to access the mocked controller
        // Since we can't easily get the instance from the function call, 
        // we'll rely on the global mock state if needed, or better, 
        // define the mock at once.
        const { DevnetEntrypoint } = require("@multiversx/sdk-core");
        const mockEntrypoint = new DevnetEntrypoint();
        const mockController = mockEntrypoint.createSmartContractController();
        (mockController.query as jest.Mock).mockResolvedValue([mockAgentDetails]);

        const result = await getAgentManifest(1);

        expect(result.content[0].type).toBe("text");
        const manifest = JSON.parse(result.content[0].text);
        expect(manifest.name).toBe("DeFi Bot");
        expect(manifest.uri).toBe("ipfs://QmTest");
    });

    it("should handle missing agents", async () => {
        const { DevnetEntrypoint } = require("@multiversx/sdk-core");
        const mockEntrypoint = new DevnetEntrypoint();
        const mockController = mockEntrypoint.createSmartContractController();
        (mockController.query as jest.Mock).mockRejectedValue(new Error("Agent not found"));

        const result = await getAgentManifest(999);
        expect(result.content[0].text).toContain("Error fetching agent manifest");
    });
});
