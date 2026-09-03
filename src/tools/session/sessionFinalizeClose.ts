import { Address, SmartContractTransactionsFactory, TransactionsFactoryConfig, TransactionComputer } from "@multiversx/sdk-core";
import { readFileSync } from "fs";
import { join } from "path";
import { ToolResult } from "../types";
import { loadNetworkConfig, createNetworkProvider } from "../networkConfig";
import { loadWalletConfig, loadWalletFromPem } from "../walletConfig";
import { createPatchedAbi } from "../../utils/patchAbi";

const txComputer = new TransactionComputer();

export async function sessionFinalizeClose(
    channelId: string
): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const walletConfig = loadWalletConfig();

    try {
        const wallet = loadWalletFromPem(walletConfig.pemPath!);
        const api = createNetworkProvider(config);
        const account = await api.getAccount(wallet.address);

        // Load and patch ABI
        const abiPath = join(__dirname, "../../abis/mpp-session.abi.json");
        const abiContent = readFileSync(abiPath, "utf8");
        const abi = createPatchedAbi(JSON.parse(abiContent));

        const contractAddress = process.env.MPP_SESSION_CONTRACT || "erd1qqqqqqqqqqqqqpgq...placeholder...";

        const factoryConfig = new TransactionsFactoryConfig({ chainID: config.chainId });
        const factory = new SmartContractTransactionsFactory({
            config: factoryConfig,
            abi: abi
        });

        const tx = await factory.createTransactionForExecute(wallet.address, {
            contract: Address.newFromBech32(contractAddress),
            function: "finalize_close",
            arguments: [channelId],
            gasLimit: BigInt(10_000_000)
        });

        tx.nonce = BigInt(account.nonce);

        const bytesToSign = txComputer.computeBytesForSigning(tx);
        tx.signature = await wallet.signer.sign(bytesToSign);
        const txHash = await api.sendTransaction(tx);

        return {
            content: [
                {
                    type: "text",
                    text: `MPP Session finalize_close transaction sent.\n\nTransaction: ${config.explorerUrl}/transactions/${txHash}\n\nNote: Closes session and refunds remaining funds to employer now that deadline has expired.`,
                },
            ],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to finalize close for MPP session: ${message}`,
                },
            ],
        };
    }
}

export const sessionFinalizeCloseToolName = "mpp-session-finalize-close";
export const sessionFinalizeCloseToolDescription = "Finalize closure and refund remaining funds after challenge deadline expires.";
