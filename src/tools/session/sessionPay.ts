import { Address } from "@multiversx/sdk-core";
import { keccak_256 } from "@noble/hashes/sha3";
import axios from "axios";
import { ToolResult } from "../types";
import { loadWalletConfig, loadWalletFromPem } from "../walletConfig";

export async function sessionPay(
    channelId: string,
    amount: string,
    nonce: number,
    facilitatorUrl: string
): Promise<ToolResult> {
    const walletConfig = loadWalletConfig();

    try {
        const wallet = loadWalletFromPem(walletConfig.pemPath!);
        
        // Construct the message to be signed
        // The contract expects: keccak256(prefix + scAddress + channelId + amount + nonce)
        // prefix: "mpp-session-v1"
        // scAddress: the address of the escrow contract
        // channelId: bytes32
        // amount: BigUint (BE bytes)
        // nonce: u64 (8 bytes, BE)

        const contractAddress = process.env.MPP_SESSION_CONTRACT || "erd1qqqqqqqqqqqqqpgq...placeholder...";
        const scAddress = Address.newFromBech32(contractAddress);
        const channelIdBuffer = Buffer.from(channelId, "hex");
        
        // amount (BigUint serialization: BE bytes)
        const amountBI = BigInt(amount);
        let amountHex = amountBI.toString(16);
        if (amountHex.length % 2 !== 0) amountHex = "0" + amountHex;
        const amountBytes = Buffer.from(amountHex, "hex");
        
        // nonce (u64, 8 bytes)
        const nonceBuffer = Buffer.alloc(8);
        nonceBuffer.writeBigUInt64BE(BigInt(nonce));

        // Concatenate and hash
        const message = Buffer.concat([
            Buffer.from("mpp-session-v1"),
            scAddress.getPublicKey(),
            channelIdBuffer,
            amountBytes,
            nonceBuffer
        ]);

        const hash = keccak_256(message);
        const signature = await wallet.signer.sign(Buffer.from(hash));

        // Submit voucher to Facilitator
        await axios.post(`${facilitatorUrl}/sessions/${channelId}/vouchers`, {
            amount,
            nonce,
            signature: Buffer.from(signature).toString("hex")
        });

        return {
            content: [
                {
                    type: "text",
                    text: `Voucher for ${amount} units issued and submitted to Facilitator.\n\nNonce: ${nonce}\nChannel ID: ${channelId}`,
                },
            ],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to issue voucher: ${message}`,
                },
            ],
        };
    }
}

export const sessionPayToolName = "mpp-session-pay";
export const sessionPayToolDescription = "Issue an off-chain payment voucher for an active MPP session.";
