import { getAgentManifest } from "../getAgentManifest";
import { getAgentTrustSummary } from "../getAgentTrustSummary";
import { getAgentReputation, submitAgentFeedback } from "../agentReputation";
import { isJobVerified, submitJobProof, verifyJob } from "../jobValidation";
import { createNetworkProvider } from "../../networkConfig";
import { Address } from "@multiversx/sdk-core";

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
                    data: "YQ==", // "a" in base64
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
    })
}));

describe("Registry Tools", () => {
    const mockApi = createNetworkProvider({} as any);

    describe("get-agent-manifest", () => {
        it("should fetch and parse agent manifest from updateAgent transaction", async () => {
            const mockTxData = {
                data: "update_agent@3031@68747470733a2f2f6578616d706c652e636f6d@616263313233"
            };
            (mockApi.doGetGeneric as jest.Mock).mockResolvedValue([mockTxData]);

            const result = await getAgentManifest(1);
            const content = JSON.parse(result.content[0].text);

            expect(content.name).toBe("Agent #01");
            expect(content.uri).toBe("https://example.com");
            expect(content.public_key).toBe("616263313233");
        });

        it("should fetch and parse agent manifest from registerAgent transaction", async () => {
            const mockTxData = {
                data: "register_agent@546573744167656e74@68747470733a2f2f746573742e636f6d@646566343536"
            };
            (mockApi.doGetGeneric as jest.Mock).mockResolvedValue([mockTxData]);

            const result = await getAgentManifest(1);
            const content = JSON.parse(result.content[0].text);

            expect(content.name).toBe("TestAgent");
            expect(content.uri).toBe("https://test.com");
            expect(content.public_key).toBe("646566343536");
        });

        it("should handle invalid registration data format", async () => {
            (mockApi.doGetGeneric as jest.Mock).mockResolvedValue([{ data: "register_agent@onlyname" }]);
            const result = await getAgentManifest(1);
            expect(result.content[0].text).toContain("Invalid registration data format");
        });
    });

    describe("get-agent-trust-summary", () => {
        it("should return trust metrics for an agent", async () => {
            (mockApi.queryContract as jest.Mock).mockImplementation((query) => {
                if (query.function === "getReputationScore") {
                    return Promise.resolve({ returnDataParts: [Buffer.from([0, 0, 0x23, 0x28])] }); // 9000
                }
                if (query.function === "getTotalJobs") {
                    return Promise.resolve({ returnDataParts: [Buffer.from([0, 0, 0, 0x64])] }); // 100
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
            expect(tx.data).toBe("YQ=="); // matches mock
        });
    });

    describe("job-validation", () => {
        it("should check if job is verified", async () => {
            (mockApi.queryContract as jest.Mock).mockResolvedValue({ returnDataParts: [Buffer.from([0x01])] });
            const result = await isJobVerified("job-1");
            const content = JSON.parse(result.content[0].text);
            expect(content.verified).toBeDefined();
        });

        it("should create proof transaction", async () => {
            const customSender = "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv";
            const result = await submitJobProof("job-1", "68617368", customSender); // "hash" in hex
            const tx = JSON.parse(result.content[0].text);
            expect(tx.sender).toBe(customSender);
        });

        it("should create verify transaction", async () => {
            const customSender = "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv";
            const result = await verifyJob("job-1", true, customSender);
            if (result.isError) {
                console.log("VerifyJob Error:", result.content[0].text);
            }
            const tx = JSON.parse(result.content[0].text);
            expect(tx.sender).toBe(customSender);
        });
    });
});
