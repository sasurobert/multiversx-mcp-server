import { searchAgents } from "../searchAgents";
import { getTopRatedAgents } from "../getTopRatedAgents";
import axios from "axios";

jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const mockIdentityQuery = jest.fn();
const mockReputationQuery = jest.fn();

jest.mock("../../networkConfig", () => ({
    loadNetworkConfig: jest.fn().mockReturnValue({ apiUrl: "https://api.testnet.multiversx.com", chainId: "T" }),
    createEntrypoint: jest.fn().mockReturnValue({
        createSmartContractController: jest.fn().mockImplementation((abi: unknown) => ({
            query: jest.fn().mockImplementation((opts: { function: string }) => {
                if (opts.function === "get_agent_token_id") return mockIdentityQuery();
                if (opts.function === "get_reputation_score") return mockReputationQuery();
                return Promise.resolve([]);
            }),
        })),
    }),
}));

describe("Discovery Tools", () => {
    describe("search-agents", () => {
        beforeEach(() => {
            mockIdentityQuery.mockReset();
            mockReputationQuery.mockReset();
        });

        it("should return agents matching the query", async () => {
            const mockNfts = [
                {
                    identifier: "AGENT-1",
                    name: "DeFi Bot",
                    nonce: 1,
                    owner: "erd1...",
                    url: "ipfs://...",
                    collection: "AGENTS",
                    timestamp: 123456
                }
            ];
            mockIdentityQuery.mockResolvedValue(["ACT-e4c050"]);
            mockReputationQuery.mockResolvedValue([{ valueOf: () => 95n }]);
            mockedAxios.get.mockResolvedValue({ data: mockNfts });

            const result = await searchAgents("DeFi");
            const agents = JSON.parse(result.content[0].text);

            expect(agents).toHaveLength(1);
            expect(agents[0].name).toBe("DeFi Bot");
            expect(agents[0].reputation_score).toBe(95);
            expect(mockedAxios.get).toHaveBeenCalledWith(expect.stringContaining("/nfts"), expect.any(Object));
        });

        it("should return no agents found message if no matches", async () => {
            mockIdentityQuery.mockResolvedValue(["ACT-e4c050"]);
            mockedAxios.get.mockResolvedValue({ data: [] });
            const result = await searchAgents("NonExistent");
            expect(result.content[0].text).toContain('No agents found matching query');
        });

        it("should filter by minTrust", async () => {
            const mockNfts = [
                { identifier: "A1", name: "High Trust", nonce: 1, owner: "erd1...", url: "", collection: "ACT", timestamp: 0 },
                { identifier: "A2", name: "Low Trust", nonce: 2, owner: "erd1...", url: "", collection: "ACT", timestamp: 0 }
            ];
            mockIdentityQuery.mockResolvedValue(["ACT-e4c050"]);
            mockReputationQuery
                .mockResolvedValueOnce([{ valueOf: () => 85n }])
                .mockResolvedValueOnce([{ valueOf: () => 80n }]);
            mockedAxios.get.mockResolvedValue({ data: mockNfts });

            const result = await searchAgents("query", 90);
            expect(result.content[0].text).toContain('No agents found');
        });

        it("should handle API errors", async () => {
            mockIdentityQuery.mockResolvedValue(["ACT-e4c050"]);
            mockedAxios.get.mockRejectedValue(new Error("API Down"));
            const result = await searchAgents("test");
            expect(result.content[0].text).toContain("Error searching for agents: API Down");
        });
    });

    describe("get-top-rated-agents", () => {
        beforeEach(() => {
            mockIdentityQuery.mockReset();
            mockReputationQuery.mockReset();
        });

        it("should return sorted agents by reputation", async () => {
            const mockNfts = [
                { identifier: "A1", name: "Agent 1", nonce: 1, url: "u1" },
                { identifier: "A2", name: "Agent 2", nonce: 2, url: "u2" }
            ];
            mockIdentityQuery.mockResolvedValue(["ACT-e4c050"]);
            mockReputationQuery
                .mockResolvedValueOnce([{ valueOf: () => 9000n }])
                .mockResolvedValueOnce([{ valueOf: () => 10000n }]);
            mockedAxios.get.mockResolvedValue({ data: mockNfts });

            const result = await getTopRatedAgents("all", 2);
            const top = JSON.parse(result.content[0].text);

            expect(top[0].name).toBe("Agent 2"); // Higher score
            expect(top[0].reputation_score).toBe(10000);
            expect(top[1].name).toBe("Agent 1");
        });

        it("should handle empty results", async () => {
            mockIdentityQuery.mockResolvedValue(["ACT-e4c050"]);
            mockedAxios.get.mockResolvedValue({ data: [] });

            const result = await getTopRatedAgents("all");
            expect(result.content[0].text).toBe("[]");
        });

        it("should handle error in reputation fetch for some agents", async () => {
            const mockNfts = [{ identifier: "A1", name: "Agent 1", nonce: 1, url: "u1" }];
            mockIdentityQuery.mockResolvedValue(["ACT-e4c050"]);
            mockedAxios.get.mockResolvedValue({ data: mockNfts });
            mockReputationQuery.mockRejectedValue(new Error("VM Error"));

            const result = await getTopRatedAgents("all");
            const top = JSON.parse(result.content[0].text);
            expect(top).toHaveLength(1);
            expect(top[0].reputation_score).toBe(0); // Failed fetch returns 0
        });

        it("should handle global API failure", async () => {
            mockIdentityQuery.mockRejectedValue(new Error("Network Error"));

            const result = await getTopRatedAgents("all");
            expect(result.content[0].text).toContain("Error fetching top rated agents: Network Error");
        });
    });
});
