import { z } from "zod";
import { Transaction, TransactionComputer, IPlainTransactionObject } from "@multiversx/sdk-core";
import { ToolResult } from "./types";
import { loadNetworkConfig, createNetworkProvider } from "./networkConfig";
import { loadWalletConfig, loadWalletFromPem, loadWalletsFromDir, getWalletAddress, LoadedWallet } from "./walletConfig";
import { Address } from "@multiversx/sdk-core";

const txComputer = new TransactionComputer();

/**
 * Acts as a relayer for a signed transaction (RelayedV3).
 * The inner transaction must be already signed by the user.
 * The relayer (this MCP server's wallet) pays for gas by adding its own signature.
 * Requires MVX_WALLET_PEM to be set.
 */
export async function createRelayedV3(
    innerTransaction: any
): Promise<ToolResult> {
    const walletConfig = loadWalletConfig();

    try {
        const config = loadNetworkConfig();
        const api = createNetworkProvider(config);

        // Reconstruct inner transaction from plain object
        const tx = Transaction.newFromPlainObject(innerTransaction);
        const sender = tx.sender;

        // Determine Relayer Wallet
        let relayerWallet: LoadedWallet;

        // 1. Try single PEM
        if (walletConfig.pemPath) {
            relayerWallet = loadWalletFromPem(walletConfig.pemPath);
            // Verify shard match (basic check: try to sign, if network rejects, it rejects)
            // Ideally we check shard here.
        }
        // 2. Try Wallets Dir (Multi-shard)
        else if (walletConfig.walletsDir) {
            const wallets = loadWalletsFromDir(walletConfig.walletsDir);
            const senderShard = getShard(sender);

            relayerWallet = wallets.find(w => getShard(w.address) === senderShard)!;

            if (!relayerWallet) {
                // Fallback to first if only one? Or fail?
                if (wallets.length > 0) relayerWallet = wallets[0]; // Best effort or strict fail?
                else throw new Error("No relayer wallets found in directory.");
            }
        } else {
            throw new Error("MVX_WALLET_PEM or MVX_WALLET_DIR must be set.");
        }

        // VALIDATION: In Relayed V3, the sender MUST set the relayer address BEFORE signing.
        // We must not overwrite it, but we MUST verify it's correct for the relayer's address.
        if (!tx.relayer || tx.relayer.toBech32() !== relayerWallet.address.toBech32()) {
            throw new Error(`Invalid relayer address. Expected ${relayerWallet.address.toBech32()} for sender's shard.`);
        }

        if (tx.version < 2) {
            throw new Error("Invalid transaction version for Relayed V3. Expected version >= 2.");
        }

        // Sign the transaction as relayer using TransactionComputer
        const bytesToSign = txComputer.computeBytesForSigning(tx);
        const signature = await relayerWallet.signer.sign(bytesToSign);
        tx.relayerSignature = signature;

        // Send the transaction
        const txHash = await api.sendTransaction(tx);

        return {
            content: [
                {
                    type: "text",
                    text: `RelayedV3 transaction sent: ${config.explorerUrl}/transactions/${txHash}\n\nTransaction Hash: ${txHash}`,
                },
            ],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Failed to create RelayedV3 transaction: ${message}` }],
        };
    }
}

export const createRelayedV3ToolName = "create-relayed-v3";
export const createRelayedV3ToolDescription = "Co-sign a signed inner transaction as a relayer for gas sponsoring (RelayedV3)";
export const createRelayedV3ParamScheme = {
    innerTransaction: z.any().describe("The signed transaction object (as plain JSON)"),
};

// Helper for Shards (3 shards default)
function getShard(address: Address): number {
    const pubKey = address.getPublicKey();
    const lastByte = pubKey[31];
    let mask = 0x03;
    let shard = lastByte & mask;
    if (shard > 2) {
        shard = lastByte & 0x01;
    }
    return shard;
}
