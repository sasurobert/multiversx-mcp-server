import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig } from "../networkConfig";
import { Transaction, Address } from "@multiversx/sdk-core";

const BECH32_PREFIX = "erd1";
const ZERO_ADDRESS = "erd1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq6gq4hu";

function isValidBech32(address: string): boolean {
    return typeof address === "string" && address.startsWith(BECH32_PREFIX) && address.length >= 59 && address.length <= 62;
}

/**
 * Creates an unsigned transaction for purchasing a product (NFT/SFT).
 * Returns a standardized JSON object for interactive signing.
 */
export async function createPurchaseTransaction(params: {
    tokenIdentifier: string;
    nonce: number;
    quantity: number;
    receiver: string;
    price: string;
    sender?: string;
}): Promise<ToolResult> {
    try {
        if (!params.tokenIdentifier?.trim()) {
            return { content: [{ type: "text", text: "Error: tokenIdentifier is required and cannot be empty." }] };
        }
        if (params.nonce < 0 || !Number.isInteger(params.nonce)) {
            return { content: [{ type: "text", text: "Error: nonce must be a non-negative integer." }] };
        }
        if (params.quantity < 1 || !Number.isInteger(params.quantity)) {
            return { content: [{ type: "text", text: "Error: quantity must be a positive integer." }] };
        }
        if (!isValidBech32(params.receiver)) {
            return { content: [{ type: "text", text: "Error: receiver must be a valid bech32 address (erd1...)." }] };
        }
        if (params.sender !== undefined && !isValidBech32(params.sender)) {
            return { content: [{ type: "text", text: "Error: sender must be a valid bech32 address (erd1...)." }] };
        }
        const priceBigInt = BigInt(params.price);
        if (priceBigInt < 0n) {
            return { content: [{ type: "text", text: "Error: price must be a non-negative integer string." }] };
        }

        const config = loadNetworkConfig();

        const tokenIdentifierHex = Buffer.from(params.tokenIdentifier, "utf-8").toString("hex");
        const nonceHex = params.nonce.toString(16).padStart(2, "0");
        const quantityHex = params.quantity.toString(16).padStart(2, "0");
        const data = `buy@${tokenIdentifierHex}@${nonceHex}@${quantityHex}`;

        const senderAddress = params.sender
            ? Address.newFromBech32(params.sender)
            : Address.newFromBech32(ZERO_ADDRESS);

        const tx = new Transaction({
            nonce: 0n,
            value: priceBigInt,
            receiver: Address.newFromBech32(params.receiver),
            sender: senderAddress,
            gasLimit: 10_000_000n,
            chainID: config.chainId,
            data: Buffer.from(data, "utf-8"),
            version: 1,
        });

        const txJson = tx.toPlainObject();
        return {
            content: [{ type: "text", text: JSON.stringify(txJson, null, 2) }]
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Error creating purchase transaction: ${message}` }]
        };
    }
}

export const createPurchaseTransactionToolName = "create-purchase-transaction";
export const createPurchaseTransactionToolDescription = "Create an unsigned transaction for interactive product purchase";
export const createPurchaseTransactionParamScheme = {
    tokenIdentifier: z.string().describe("The token identifier (e.g. TICKER-123456)"),
    nonce: z.number().describe("The NFT/SFT nonce"),
    quantity: z.number().describe("Quantity to purchase"),
    receiver: z.string().describe("The marketplace or contract address"),
    price: z.string().describe("The price in atomic units (e.g. 1000000000000000000 for 1 EGLD)"),
    sender: z.string().optional().describe("The buyer's bech32 address. When omitted, zero address is used (must be set before signing)"),
};
