import { getAgentPricing } from "../getAgentPricing";
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
    createEntrypoint: jest.requireActual("@multiversx/sdk-core").DevnetEntrypoint
}));

describe("getAgentPricing", () => {
    it("should fetch agent pricing using ABI", async () => {
        const mockPrice = 5000000000000000n; // 0.005 EGLD
        const { DevnetEntrypoint } = require("@multiversx/sdk-core");
        const mockEntrypoint = new DevnetEntrypoint();
        const mockController = mockEntrypoint.createSmartContractController();
        (mockController.query as jest.Mock).mockResolvedValue([mockPrice]);

        const result = await getAgentPricing(1, "chat");

        expect(result.content[0].type).toBe("text");
        const pricing = JSON.parse(result.content[0].text);
        expect(pricing.price).toBe(mockPrice.toString());
        expect(pricing.service_id).toBe("chat");
    });
});
