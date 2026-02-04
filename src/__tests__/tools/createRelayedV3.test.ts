import { createRelayedV3 } from "../../tools/createRelayedV3";

// Mock SDK
jest.mock("@multiversx/sdk-core", () => {
    return {
        Transaction: {
            newFromPlainObject: jest.fn().mockImplementation((obj) => ({
                ...obj,
                relayer: obj.relayer ? { toBech32: () => obj.relayer } : undefined,
                toPlainObject: () => obj
            }))
        },
        TransactionComputer: jest.fn().mockImplementation(() => ({
            computeBytesForSigning: jest.fn().mockReturnValue(Buffer.from("mock-bytes")),
        })),
        Address: {
            newFromBech32: jest.fn().mockImplementation((addr) => ({ toBech32: () => addr }))
        }
    };
});

jest.mock("../../tools/networkConfig", () => ({
    loadNetworkConfig: jest.fn().mockReturnValue({ chainId: "D", explorerUrl: "https://devnet-explorer.multiversx.com" }),
    createNetworkProvider: jest.fn().mockReturnValue({
        sendTransaction: jest.fn().mockResolvedValue("relayed-tx-hash"),
    }),
}));

const mockWalletConfig = {
    pemPath: "relayer.pem",
};

jest.mock("../../tools/walletConfig", () => ({
    loadWalletConfig: jest.fn().mockImplementation(() => mockWalletConfig),
    loadWalletFromPem: jest.fn().mockReturnValue({
        address: { toBech32: () => "relayer-addr" },
        signer: { sign: jest.fn().mockResolvedValue(Buffer.from("relayer-signature")) },
    }),
}));

describe("create-relayed-v3", () => {
    it("should successfully relay a signed transaction", async () => {
        const innerTx = {
            nonce: 10,
            value: "1000",
            receiver: "erd1...",
            sender: "erd1-user",
            gasLimit: "100000",
            chainID: "D",
            data: "base64data",
            signature: "user-signature",
            relayer: "relayer-addr",
            version: 2
        };

        const result = await createRelayedV3(innerTx);
        expect(result.content[0].text).toContain("RelayedV3 transaction sent");
        expect(result.content[0].text).toContain("relayed-tx-hash");
    });

    it("should handle signing errors", async () => {
        const { loadWalletFromPem } = require("../../tools/walletConfig");
        (loadWalletFromPem as jest.Mock).mockImplementationOnce(() => {
            throw new Error("Relayer wallet error");
        });

        const result = await createRelayedV3({});
        expect(result.content[0].text).toContain("Failed to create RelayedV3 transaction: Relayer wallet error");
    });
});
