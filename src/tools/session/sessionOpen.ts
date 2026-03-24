import { Address, Token, TokenTransfer, SmartContractTransactionsFactory, TransactionsFactoryConfig, TransactionComputer } from "@multiversx/sdk-core";
import { readFileSync } from "fs";
import { join } from "path";
import { ToolResult } from "../types";
import { loadNetworkConfig, createNetworkProvider } from "../networkConfig";
import { loadWalletConfig, loadWalletFromPem } from "../walletConfig";
import { createPatchedAbi } from "../../utils/patchAbi";

const txComputer = new TransactionComputer();

export async function sessionOpen(
    receiver: string,
    amount: string,
    tokenIdentifier?: string,
    deadline?: number
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

        // Handle payment
        let payment;
        const amountBI = BigInt(amount);
        if (!tokenIdentifier || tokenIdentifier === "EGLD") {
            payment = new TokenTransfer({
                token: new Token({ identifier: "EGLD" }),
                amount: amountBI
            });
        } else {
            payment = new TokenTransfer({
                token: new Token({ identifier: tokenIdentifier }),
                amount: amountBI
            });
        }

        const tx = await factory.createTransactionForExecute(wallet.address, {
            contract: Address.newFromBech32(contractAddress),
            function: "open",
            arguments: [
                Address.newFromBech32(receiver),
                tokenIdentifier || "EGLD",
                BigInt(deadline || Math.floor(Date.now() / 1000) + 3600)
            ],
            gasLimit: BigInt(10_000_000),
            tokenTransfers: [payment]
        });

        tx.nonce = BigInt(account.nonce);

        // Sign and send
        const bytesToSign = txComputer.computeBytesForSigning(tx);
        tx.signature = await wallet.signer.sign(bytesToSign);
        const txHash = await api.sendTransaction(tx);

        return {
            content: [
                {
                    type: "text",
                    text: `MPP Session open transaction sent.\n\nTransaction: ${config.explorerUrl}/transactions/${txHash}\n\nNote: Once confirmed, you can start issuing vouchers using the channel ID from transaction logs.`,
                },
            ],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [
                {
                    type: "text",
                    text: `Failed to open MPP session: ${message}`,
                },
            ],
        };
    }
}

export const sessionOpenToolName = "mpp-session-open";
export const sessionOpenToolDescription = "Open a new MPP session by locking funds in the escrow contract.";
