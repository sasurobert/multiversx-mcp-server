import { createPurchaseTransaction } from "../createPurchaseTransaction";

// Mock SDK
jest.mock("@multiversx/sdk-core", () => ({
    Address: {
        newFromBech32: jest.fn().mockImplementation((addr) => ({ toBech32: () => addr })),
    },
    Transaction: jest.fn().mockImplementation((args) => ({
        toPlainObject: () => ({
            ...args,
            receiver: args.receiver.toBech32(),
            sender: args.sender ? args.sender.toBech32() : undefined,
            value: args.value.toString(),
            gasLimit: args.gasLimit.toString(),
            nonce: Number(args.nonce),
            chainID: args.chainID || "1",
            data: args.data ? Buffer.from(args.data).toString("base64") : undefined,
            version: args.version || 1
        }),
    })),
}));

jest.mock("../../networkConfig", () => ({
    loadNetworkConfig: jest.fn().mockReturnValue({ chainId: "1", apiUrl: "https://api.multiversx.com" }),
    createNetworkProvider: jest.fn(),
}));

describe("Commerce Tools", () => {
    describe("create_purchase_transaction", () => {
        it("should return a standardized unsigned transaction for a product purchase", async () => {
            const result = await createPurchaseTransaction({
                tokenIdentifier: "TEST-123456",
                nonce: 1,
                quantity: 2,
                receiver: "erd1qqqqqqqqqqqqqpgqfzydqrew7dr666u64q60zk98v665v7f5pccshv882p",
                price: "1000000000000000000"
            });

            const tx = JSON.parse(result.content[0].text);
            expect(tx).toHaveProperty("receiver");
            expect(tx).toHaveProperty("value");
            expect(tx).toHaveProperty("data");
            expect(tx).toHaveProperty("chainID");
            expect(tx).not.toHaveProperty("signature");

            const dataHex = Buffer.from(tx.data, "base64").toString("utf-8");
            expect(dataHex).toContain("buy@");
            expect(dataHex).toMatch(/buy@[a-f0-9]+@01@02/);
        });

        it("should use sender when provided", async () => {
            const customSender = "erd1qyu5wgts7fp92az5y2yuqlsq0zy7gu3g5pcsq7yfu3ez3gr3qpuq00xjqv";
            const result = await createPurchaseTransaction({
                tokenIdentifier: "TEST-123",
                nonce: 1,
                quantity: 1,
                receiver: "erd1qqqqqqqqqqqqqpgqfzydqrew7dr666u64q60zk98v665v7f5pccshv882p",
                price: "0",
                sender: customSender
            });

            const tx = JSON.parse(result.content[0].text);
            expect(tx.sender).toBe(customSender);
        });

        it("should reject invalid receiver address", async () => {
            const result = await createPurchaseTransaction({
                tokenIdentifier: "TEST-123",
                nonce: 1,
                quantity: 1,
                receiver: "invalid-address",
                price: "1000"
            });

            expect(result.content[0].text).toContain("Error");
            expect(result.content[0].text).toContain("receiver");
        });
    });
});
