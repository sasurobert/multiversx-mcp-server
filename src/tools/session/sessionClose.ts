import { Address, SmartContractTransactionsFactory, TransactionsFactoryConfig, TransactionComputer } from "@multiversx/sdk-core";
import { readFileSync } from "fs";
import { join } from "path";
import axios from "axios";
import { ToolResult } from "../types";
import { loadNetworkConfig, createNetworkProvider } from "../networkConfig";
import { loadWalletConfig, loadWalletFromPem } from "../walletConfig";
import { createPatchedAbi } from "../../utils/patchAbi";

const txComputer = new TransactionComputer();

export async function sessionClose(
    channelId: string,
    facilitatorUrl: string
): Promise<ToolResult> {
    const config = loadNetworkConfig();
    const walletConfig = loadWalletConfig();

    try {
        const wallet = loadWalletFromPem(walletConfig.pemPath!);
        const api = createNetworkProvider(config);
        const account = await api.getAccount(wallet.address);

        // Fetch latest voucher from Facilitator
        const voucherResponse = await axios.get(`${facilitatorUrl}/sessions/${channelId}`);
        const voucher = voucherResponse.data;

        if (!voucher.signature) {
            throw new Error("No signed voucher found for this session.");
        }

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
            function: "close",
            arguments: [
                channelId,
                BigInt(voucher.amount),
                BigInt(voucher.nonce || 0),
                Buffer.from(voucher.signature, "hex")
            ],
            gasLimit: BigInt(15_000_000)
        });

        tx.nonce = BigInt(account.nonce);

        const bytesToSign = txComputer.computeBytesForSigning(tx);
        tx.signature = await wallet.signer.sign(bytesToSign);
        const txHash = await api.sendTransaction(tx);

        return {
            content: [
                {
                    type: "text",
                    text: `MPP Session close transaction sent.\n\nTransaction: ${config.explorerUrl}/transactions/${txHash}\n\nNote: Settles authorized amount and refunds remaining balance to employer.`,
                },
            ],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to close MPP session: ${message}`,
                },
            ],
        };
    }
}

export const sessionCloseToolName = "mpp-session-close";
export const sessionCloseToolDescription = "Close an MPP payment session using the latest voucher, settling funds and refunding change.";
