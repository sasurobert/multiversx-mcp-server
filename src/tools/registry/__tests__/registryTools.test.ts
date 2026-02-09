import { getAgentManifest } from "../getAgentManifest";
import { getAgentTrustSummary } from "../getAgentTrustSummary";
import { getAgentReputation, submitAgentFeedback } from "../agentReputation";
import { isJobVerified, submitJobProof, verifyJob } from "../jobValidation";
import { createNetworkProvider } from "../../networkConfig";
import { Address } from "@multiversx/sdk-core";

// --- Shared mock fns for entrypoint-based tools (safe for jest.mock hoisting) ---
const mockControllerQuery = jest.fn();
const mockFactoryExecute = jest.fn();

jest.mock("fs", () => ({
    readFileSync: jest.fn().mockReturnValue("{}"),
    existsSync: jest.fn().mockReturnValue(true),
}));

jest.mock("@multiversx/sdk-core", () => {
    const original = jest.requireActual("@multiversx/sdk-core");
    return {
        ...original,
        AbiRegistry: {
            create: jest.fn().mockReturnValue({
                getEndpoint: jest.fn().mockReturnValue({
                    output: [{ type: { name: "u64" } }],
                    input: []
                })
            })
        },
        SmartContractTransactionsFactory: jest.fn().mockImplementation(() => ({
            createTransactionForExecute: jest.fn().mockResolvedValue({
                toPlainObject: () => ({
                    nonce: 1,
                    value: "0",
                    receiver: "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv",
                    sender: "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv",
                    gasLimit: 60000000,
                    chainID: "T",
                    data: "YQ==",
                    version: 2
                })
            })
        })),
        NativeSerializer: {
            nativeToTypedValues: jest.fn().mockReturnValue([])
        },
        ArgSerializer: jest.fn().mockImplementation(() => ({
            buffersToValues: jest.fn().mockReturnValue([{ valueOf: () => 90n }]),
            valuesToBuffers: jest.fn().mockReturnValue([])
        }))
    };
});

jest.mock("../../networkConfig", () => ({
    loadNetworkConfig: jest.fn().mockReturnValue({ apiUrl: "https://api.testnet.multiversx.com", chainId: "T" }),
    createNetworkProvider: jest.fn().mockReturnValue({
        doGetGeneric: jest.fn(),
        queryContract: jest.fn(),
    }),
    createEntrypoint: jest.fn().mockImplementation(() => ({
        createSmartContractController: jest.fn().mockReturnValue({ query: mockControllerQuery }),
        createSmartContractTransactionsFactory: jest.fn().mockReturnValue({
            createTransactionForExecute: mockFactoryExecute
        })
    }))
}));

describe("Registry Tools", () => {
    const mockApi = createNetworkProvider({} as unknown as Parameters<typeof createNetworkProvider>[0]);

    beforeEach(() => {
        mockControllerQuery.mockReset();
        mockFactoryExecute.mockReset();
        mockFactoryExecute.mockResolvedValue({
            toPlainObject: () => ({
                nonce: 1,
                value: "0",
                receiver: "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv",
                sender: "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv",
                gasLimit: 60000000,
                chainID: "T",
                data: "YQ==",
                version: 2
            })
        });
    });

    describe("get-agent-manifest", () => {
        it("should fetch and parse agent manifest using ABI controller", async () => {
            const mockAgentDetails = {
                name: "TestAgent",
                uri: "https://test.com",
                public_key: "def456",
                owner: Address.newFromBech32("erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu"),
                metadata: [{ key: "version", value: "1.0" }]
            };
            mockControllerQuery.mockResolvedValue([mockAgentDetails]);

            const result = await getAgentManifest(1);
            const content = JSON.parse(result.content[0].text);

            expect(content.name).toBe("TestAgent");
            expect(content.uri).toBe("https://test.com");
        });

        it("should handle empty results from controller query", async () => {
            mockControllerQuery.mockResolvedValue([]);

            const result = await getAgentManifest(1);
            expect(result.content[0].text).toContain("not found");
        });

        it("should handle query errors gracefully", async () => {
            mockControllerQuery.mockRejectedValue(new Error("Contract error"));
            const result = await getAgentManifest(1);
            expect(result.content[0].text).toContain("Error fetching agent manifest");
        });
    });

    describe("get-agent-trust-summary", () => {
        it("should return trust metrics for an agent", async () => {
            (mockApi.queryContract as jest.Mock).mockImplementation((query: { function: string }) => {
                if (query.function === "getReputationScore") {
                    return Promise.resolve({ returnDataParts: [Buffer.from([0, 0, 0x23, 0x28])] });
                }
                if (query.function === "getTotalJobs") {
                    return Promise.resolve({ returnDataParts: [Buffer.from([0, 0, 0, 0x64])] });
                }
                return Promise.resolve({ returnDataParts: [] });
            });

            const result = await getAgentTrustSummary(1);
            const content = JSON.parse(result.content[0].text);

            expect(Number(content.reputation_score) > 0).toBe(true);
            expect(Number(content.total_completed_jobs) > 0).toBe(true);
            expect(content.status).toBe("highly_trusted");
        });
    });

    describe("agent-reputation", () => {
        it("should return reputation data", async () => {
            (mockApi.queryContract as jest.Mock).mockResolvedValue({ returnDataParts: [Buffer.from([0, 0, 0x23, 0x28])] });

            const result = await getAgentReputation(1);
            const content = JSON.parse(result.content[0].text);
            expect(content.reputation_score).toBeDefined();
        });

        it("should create feedback transaction", async () => {
            const result = await submitAgentFeedback(1, 5);
            const tx = JSON.parse(result.content[0].text);
            expect(tx.receiver).toBeDefined();
            expect(tx.data).toBe("YQ==");
        });
    });

    describe("job-validation", () => {
        it("should check if job is verified", async () => {
            mockControllerQuery.mockResolvedValue([{ valueOf: () => true }]);
            const result = await isJobVerified("job-1");
            const content = JSON.parse(result.content[0].text);
            expect(content.verified).toBeDefined();
        });

        it("should create proof transaction", async () => {
            const customSender = "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv";
            const result = await submitJobProof("job-1", "68617368", customSender);
            const tx = JSON.parse(result.content[0].text);
            expect(tx.sender).toBe(customSender);
        });

        it("should create verify transaction", async () => {
            const customSender = "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv";
            const result = await verifyJob("job-1", true, customSender);
            const tx = JSON.parse(result.content[0].text);
            expect(tx.sender).toBe(customSender);
        });
    });
});
