import { getAgentPricing } from "../getAgentPricing";

// Shared mock — jest.fn() is safe for jest.mock hoisting
const mockQuery = jest.fn();

jest.mock("../../networkConfig", () => ({
    loadNetworkConfig: jest.fn().mockReturnValue({ apiUrl: "https://devnet-api.multiversx.com", chainId: "D" }),
    createEntrypoint: jest.fn().mockImplementation(() => ({
        createSmartContractController: jest.fn().mockReturnValue({
            query: mockQuery
        })
    }))
}));

describe("getAgentPricing", () => {
    beforeEach(() => {
        mockQuery.mockReset();
    });

    it("should fetch agent pricing using ABI", async () => {
        const mockServiceConfig = {
            price: 5000000000000000n,
            token: { identifier: { toString: () => "EGLD-000000" } },
            pnonce: 0n,
        };
        mockQuery.mockResolvedValue([mockServiceConfig]);

        const result = await getAgentPricing(1, "chat");

        expect(result.content[0].type).toBe("text");
        const pricing = JSON.parse(result.content[0].text);
        expect(pricing.price).toBe("5000000000000000");
        expect(pricing.service_id).toBe("chat");
    });

    it("should handle missing service config", async () => {
        mockQuery.mockResolvedValue([]);

        const result = await getAgentPricing(1, "unknown-service");
        expect(result.content[0].text).toContain("not found");
    });

    it("should handle query errors", async () => {
        mockQuery.mockRejectedValue(new Error("Contract not found"));

        const result = await getAgentPricing(999, "chat");
        expect(result.content[0].text).toContain("Error fetching agent pricing");
    });
});
