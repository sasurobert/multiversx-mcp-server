import { z } from "zod";
import { TokenManagementTransactionsFactory, TransactionsFactoryConfig, Transaction, TransactionComputer } from "@multiversx/sdk-core";
import { ToolResult } from "./types";
import { loadNetworkConfig, createNetworkProvider } from "./networkConfig";
import { loadWalletConfig, loadWalletFromPem } from "./walletConfig";
import { ESDT_ISSUE_COST } from "./constants";

const txComputer = new TransactionComputer();

/**
 * Issue a new fungible ESDT token.
 * Requires MVX_WALLET_PEM to be set.
 */
export async function issueFungible(
    tokenName: string,
    tokenTicker: string,
    initialSupply: string,
    numDecimals: number
): Promise<ToolResult> {
    const walletConfig = loadWalletConfig();

    // Validate inputs
    if (tokenName.length < 3 || tokenName.length > 20) {
        return {
            content: [{ type: "text", text: "Token name must be 3-20 characters." }],
        };
    }

    if (tokenTicker.length < 3 || tokenTicker.length > 10) {
        return {
            content: [{ type: "text", text: "Token ticker must be 3-10 characters." }],
        };
    }

    try {
        const config = loadNetworkConfig();
        const wallet = loadWalletFromPem(walletConfig.pemPath!);
        const api = createNetworkProvider(config);
        const account = await api.getAccount(wallet.address);

        const factoryConfig = new TransactionsFactoryConfig({ chainID: config.chainId });
        const factory = new TokenManagementTransactionsFactory({ config: factoryConfig });

        const tx = await factory.createTransactionForIssuingFungible(wallet.address, {
            tokenName,
            tokenTicker,
            initialSupply: BigInt(initialSupply),
            numDecimals: BigInt(numDecimals),
            canFreeze: true,
            canWipe: true,
            canPause: true,
            canChangeOwner: true,
            canUpgrade: true,
            canAddSpecialRoles: true,
        });

        // Set nonce and apply value for issuance cost
        tx.nonce = account.nonce;
        tx.value = ESDT_ISSUE_COST;
        tx.gasLimit = BigInt(60000000); // DEFAULT_GAS_LIMIT_ISSUE from constants is 60M

        // Sign the transaction
        const bytesToSign = txComputer.computeBytesForSigning(tx);
        const signature = await wallet.signer.sign(bytesToSign);
        tx.signature = signature;

        // Send the transaction
        const txHash = await api.sendTransaction(tx);

        return {
            content: [
                {
                    type: "text",
                    text: `Token issuance transaction sent. Track status at: ${config.explorerUrl}/transactions/${txHash}\n\nNote: The token identifier will be available in the transaction logs after confirmation.`,
                },
            ],
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        return {
            content: [{ type: "text", text: `Failed to issue token: ${message}` }],
        };
    }
}

export const issueFungibleToolName = "issue-fungible-token";
export const issueFungibleToolDescription = "Issue a new fungible ESDT token on MultiversX";
export const issueFungibleParamScheme = {
    tokenName: z.string().min(3).max(20).describe("Token name (3-20 alphanumeric characters)"),
    tokenTicker: z.string().min(3).max(10).describe("Token ticker (3-10 uppercase alphanumeric)"),
    initialSupply: z.string().describe("Initial supply in atomic units"),
    numDecimals: z.number().min(0).max(18).describe("Number of decimals (0-18)"),
};
