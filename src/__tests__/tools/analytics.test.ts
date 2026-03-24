import { getRevenue, getSpend } from "../../tools/analytics/index";

describe("Analytics Tools", () => {
    const MOCK_API_URL = "https://devnet-api.multiversx.com";
    
    beforeEach(() => {
        process.env.MVX_NETWORK = "devnet";
        global.fetch = jest.fn();
    });

    afterEach(() => {
        jest.resetAllMocks();
    });

    it("should calculate revenue for an address over the last 30 days", async () => {
        const mockResponse = {
            hits: {
                total: { value: 2 },
                hits: [
                    { _source: { value: "1000000000000000000" } }, // 1 EGLD
                    { _source: { value: "500000000000000000" } }  // 0.5 EGLD
                ]
            }
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        const result = await getRevenue("erd1test123", "EGLD", 30);
        
        expect(result.content[0].text).toContain("Revenue for erd1test123");
        expect(result.content[0].text).toContain("1.5 EGLD");
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it("should calculate spend for an address over the last 30 days", async () => {
        const mockResponse = {
            hits: {
                total: { value: 1 },
                hits: [
                    { _source: { value: "2000000000000000000" } } // 2 EGLD
                ]
            }
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse
        });

        const result = await getSpend("erd1test123", "EGLD", 30);
        
        expect(result.content[0].text).toContain("Spend for erd1test123");
        expect(result.content[0].text).toContain("2 EGLD");
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});
