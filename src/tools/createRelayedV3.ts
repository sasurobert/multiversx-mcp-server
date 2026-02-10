import { z } from "zod";
import { Transaction, TransactionComputer, Address, UserVerifier, Logger } from "@multiversx/sdk-core";
import { ToolResult } from "./types";
import { loadNetworkConfig, createNetworkProvider } from "./networkConfig";
import { loadWalletConfig, loadWalletFromPem, loadWalletsFromDir, LoadedWallet } from "./walletConfig";
import { parseSimulationResult } from "../utils/simulationParser";

const txComputer = new TransactionComputer();

export interface IInnerTransaction {
    nonce: number;
    value: string;
    receiver: string;
    sender: string;
    gasPrice?: number;
    gasLimit: number | string;
    chainID: string;
    data?: string;
    version?: number;
    options?: number;
    guardian?: string;
    signature?: string;
    sndrRelay?: string;
}

export interface ISimulationResult {
    status?: { status: string };
    raw?: { status: string };
    execution?: {
        result: string;
        message?: string;
        gasConsumed?: bigint;
    };
    result?: {
        execution?: {
            result: string;
        };
    };
    error?: string;
}

/**
 * Acts as a relayer for a signed transaction (RelayedV3).
 * The inner transaction must be already signed by the user.
 * The relayer (this MCP server's wallet) pays for gas by adding its own signature.
 * Requires MVX_WALLET_PEM to be set.
 */
export async function createRelayedV3(
    innerTransaction: IInnerTransaction
): Promise<ToolResult> {
    const walletConfig = loadWalletConfig();

    try {
        const config = loadNetworkConfig();
        const api = createNetworkProvider(config);

        // Reconstruct inner transaction from plain object
        const tx = Transaction.newFromPlainObject({ gasPrice: 1000000000, ...innerTransaction } as any);
        const sender = tx.sender;

        // Determine Relayer Wallet
        let relayerWallet: LoadedWallet;

        // 1. Try single PEM
        if (walletConfig.pemPath) {
            relayerWallet = loadWalletFromPem(walletConfig.pemPath);
        }
        // 2. Try Wallets Dir (Multi-shard)
        else if (walletConfig.walletsDir) {
            const wallets = loadWalletsFromDir(walletConfig.walletsDir);
            const senderShard = getShard(sender);

            relayerWallet = wallets.find(w => getShard(w.address) === senderShard)!;

            if (!relayerWallet) {
                if (wallets.length > 0) relayerWallet = wallets[0];
                else throw new Error("No relayer wallets found in directory.");
            }
        } else {
            throw new Error("MVX_WALLET_PEM or MVX_WALLET_DIR must be set.");
        }

        // Set relayer address (must match the relayer's wallet)
        tx.relayer = relayerWallet.address;
        tx.version = 2;

        // 1. Validate Inner Transaction Signature (Crucial for V3)
        // User must have signed with 'relayer' field set to this relayer's address
        const verifier = UserVerifier.fromAddress(tx.sender);
        const innerSignatureValid = verifier.verify(txComputer.computeBytesForSigning(tx), tx.signature);
        if (!innerSignatureValid) {
            throw new Error("Invalid inner transaction signature. Ensure 'relayer' field was set to this relayer's address when signing.");
        }

        // 2. Sign the transaction as relayer 
        const bytesToSign = txComputer.computeBytesForSigning(tx);
        const signature = await relayerWallet.signer.sign(bytesToSign);
        tx.relayerSignature = signature;

        // 3. Simulation BEFORE broadcast
        const simulationResult = await api.simulateTransaction(tx) as unknown as Record<string, any>;
        Logger.info({
            simulationResult: JSON.stringify(simulationResult, (_, v) => typeof v === 'bigint' ? v.toString() : v)
        }, "Relayer: Simulation result received");

        const { success, errorMessage } = parseSimulationResult(simulationResult);
        if (!success) {
            Logger.error({
                error: errorMessage,
                simulationResult: JSON.stringify(simulationResult, (_, v) => typeof v === 'bigint' ? v.toString() : v)
            }, "Relayer: Simulation failed before broadcast");
            throw new Error(`On-chain simulation failed: ${errorMessage}`);
        }

        // 4. Send the transaction
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
