import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import * as tools from "./tools/index";
import { ToolResult } from "./tools/types";
import { createMppMiddleware, McpToolPrice } from "./utils/mpp_middleware";
// Helper to cast tool results to avoid strict TZ index signature issues with the MCP SDK.
// The SDK expects a specific result structure that includes 'content'.
const asToolResult = (p: Promise<ToolResult>) => p as Promise<any>;

export const MCP_SERVER_NAME = "multiversx-mcp-server";

export function createMcpServer() {
    const server = new McpServer({
        name: MCP_SERVER_NAME,
        version: "1.0.0",
    });

    // Register all tools
    server.tool(
        tools.getBalanceToolName,
        tools.getBalanceToolDescription,
        tools.getBalanceParamScheme,
        async ({ address }) => asToolResult(tools.getBalance(address))
    );

    server.tool(
        tools.queryAccountToolName,
        tools.queryAccountToolDescription,
        tools.queryAccountParamScheme,
        async ({ address }) => asToolResult(tools.queryAccount(address))
    );

    server.tool(
        tools.sendEgldToolName,
        tools.sendEgldToolDescription,
        tools.sendEgldParamScheme,
        async ({ receiver, amount }) => asToolResult(tools.sendEgld(receiver, amount))
    );

    server.tool(
        tools.sendTokensToolName,
        tools.sendTokensToolDescription,
        tools.sendTokensParamScheme,
        async ({ receiver, tokenIdentifier, amount, nonce }) => asToolResult(tools.sendTokens(receiver, tokenIdentifier, amount, nonce))
    );

    server.tool(
        tools.issueFungibleToolName,
        tools.issueFungibleToolDescription,
        tools.issueFungibleParamScheme,
        async ({ tokenName, tokenTicker, initialSupply, numDecimals }) => asToolResult(tools.issueFungible(tokenName, tokenTicker, initialSupply, numDecimals))
    );

    server.tool(
        tools.issueNftCollectionToolName,
        tools.issueNftCollectionToolDescription,
        tools.issueNftCollectionParamScheme,
        async ({ tokenName, tokenTicker }) => asToolResult(tools.issueNftCollection(tokenName, tokenTicker))
    );

    server.tool(
        tools.issueSemiFungibleCollectionToolName,
        tools.issueSemiFungibleCollectionToolDescription,
        tools.issueSemiFungibleCollectionParamScheme,
        async ({ tokenName, tokenTicker }) => asToolResult(tools.issueSemiFungibleCollection(tokenName, tokenTicker))
    );

    server.tool(
        tools.issueMetaEsdtCollectionToolName,
        tools.issueMetaEsdtCollectionToolDescription,
        tools.issueMetaEsdtCollectionParamScheme,
        async ({ tokenName, tokenTicker, numDecimals }) => asToolResult(tools.issueMetaEsdtCollection(tokenName, tokenTicker, numDecimals))
    );

    server.tool(
        tools.createNftToolName,
        tools.createNftToolDescription,
        tools.createNftParamScheme,
        async ({ collectionIdentifier, name, royalties, quantity, uris }) => asToolResult(tools.createNft(collectionIdentifier, name, royalties, quantity, uris))
    );

    server.tool(
        tools.sendEgldToMultipleReceiversToolName,
        tools.sendEgldToMultipleReceiversToolDescription,
        tools.sendEgldToMultipleReceiversParamScheme,
        async ({ amount, receivers }) => asToolResult(tools.sendEgldToMultipleReceivers(amount, receivers))
    );

    server.tool(
        tools.sendTokensToMultipleReceiversToolName,
        tools.sendTokensToMultipleReceiversToolDescription,
        tools.sendTokensToMultipleReceiversParamScheme,
        async ({ transfers }) => asToolResult(tools.sendTokensToMultipleReceivers(transfers))
    );

    server.tool(
        tools.createRelayedV3ToolName,
        tools.createRelayedV3ToolDescription,
        tools.createRelayedV3ParamScheme,
        async ({ innerTransaction }) => asToolResult(tools.createRelayedV3(innerTransaction))
    );

    server.tool(
        tools.trackTransactionToolName,
        tools.trackTransactionToolDescription,
        tools.trackTransactionParamScheme,
        async ({ txHash }) => asToolResult(tools.trackTransaction(txHash))
    );

    server.tool(
        tools.searchProductsToolName,
        tools.searchProductsToolDescription,
        tools.searchProductsParamScheme,
        async ({ query, collection, limit }) => asToolResult(tools.searchProducts(query, collection, limit))
    );

    server.tool(
        tools.getAgentManifestToolName,
        tools.getAgentManifestToolDescription,
        tools.getAgentManifestParamScheme,
        async ({ agentNonce }) => asToolResult(tools.getAgentManifest(agentNonce))
    );

    server.tool(
        tools.getAgentTrustSummaryToolName,
        tools.getAgentTrustSummaryToolDescription,
        tools.getAgentTrustSummaryParamScheme,
        async ({ agentNonce }) => asToolResult(tools.getAgentTrustSummary(agentNonce))
    );

    server.tool(
        tools.searchAgentsToolName,
        tools.searchAgentsToolDescription,
        tools.searchAgentsParamScheme,
        async ({ query, minTrust, limit }) => asToolResult(tools.searchAgents(query, minTrust, limit))
    );

    server.tool(
        tools.getTopRatedAgentsToolName,
        tools.getTopRatedAgentsToolDescription,
        tools.getTopRatedAgentsParamScheme,
        async ({ category, limit }) => asToolResult(tools.getTopRatedAgents(category, limit))
    );

    server.tool(
        tools.getAgentReputationToolName,
        tools.getAgentReputationToolDescription,
        tools.getAgentReputationParamScheme,
        async ({ agentNonce }) => asToolResult(tools.getAgentReputation(agentNonce))
    );

    server.tool(
        tools.submitAgentFeedbackToolName,
        tools.submitAgentFeedbackToolDescription,
        tools.submitAgentFeedbackParamScheme,
        async ({ agentNonce, rating, jobId }) => asToolResult(tools.submitAgentFeedback(agentNonce, rating, jobId))
    );

    server.tool(
        tools.isJobVerifiedToolName,
        tools.isJobVerifiedToolDescription,
        tools.isJobVerifiedParamScheme,
        async ({ jobId }) => asToolResult(tools.isJobVerified(jobId))
    );

    server.tool(
        tools.submitJobProofToolName,
        tools.submitJobProofToolDescription,
        tools.submitJobProofParamScheme,
        async ({ jobId, proofHash }) => asToolResult(tools.submitJobProof(jobId, proofHash))
    );

    server.tool(
        tools.validationRequestToolName,
        tools.validationRequestToolDescription,
        tools.validationRequestParamScheme,
        async ({ jobId, validatorAddress, requestUri, requestHash, sender }) =>
            asToolResult(tools.validationRequest(jobId, validatorAddress, requestUri, requestHash, sender))
    );

    server.tool(
        tools.validationResponseToolName,
        tools.validationResponseToolDescription,
        tools.validationResponseParamScheme,
        async ({ requestHash, response, responseUri, responseHash, tag, sender }) =>
            asToolResult(tools.validationResponse(requestHash, response, responseUri, responseHash, tag, sender))
    );

    server.tool(
        tools.verifyJobToolName,
        tools.verifyJobToolDescription,
        tools.verifyJobParamScheme,
        async ({ jobId, sender }) => asToolResult(tools.verifyJob(jobId, sender))
    );

    server.tool(
        tools.createPurchaseTransactionToolName,
        tools.createPurchaseTransactionToolDescription,
        tools.createPurchaseTransactionParamScheme,
        async ({ tokenIdentifier, nonce, quantity, receiver, price, sender }) =>
            asToolResult(tools.createPurchaseTransaction({ tokenIdentifier, nonce, quantity, receiver, price, sender }))
    );

    server.tool(
        tools.sessionOpenToolName,
        tools.sessionOpenToolDescription,
        tools.sessionOpenParamScheme,
        async ({ receiver, amount, tokenIdentifier, deadline }) => asToolResult(tools.sessionOpen(receiver, amount, tokenIdentifier, deadline))
    );

    server.tool(
        tools.sessionPayToolName,
        tools.sessionPayToolDescription,
        tools.sessionPayParamScheme,
        async ({ channelId, amount, nonce, facilitatorUrl }) => asToolResult(tools.sessionPay(channelId, amount, nonce, facilitatorUrl))
    );

    server.tool(
        tools.sessionSettleToolName,
        tools.sessionSettleToolDescription,
        tools.sessionSettleParamScheme,
        async ({ channelId, facilitatorUrl }) => asToolResult(tools.sessionSettle(channelId, facilitatorUrl))
    );

    server.tool(
        tools.sessionCloseToolName,
        tools.sessionCloseToolDescription,
        tools.sessionCloseParamScheme,
        async ({ channelId, facilitatorUrl }) => asToolResult(tools.sessionClose(channelId, facilitatorUrl))
    );

    server.tool(
        tools.sessionRequestCloseToolName,
        tools.sessionRequestCloseToolDescription,
        tools.sessionRequestCloseParamScheme,
        async ({ channelId }) => asToolResult(tools.sessionRequestClose(channelId))
    );

    server.tool(
        tools.sessionFinalizeCloseToolName,
        tools.sessionFinalizeCloseToolDescription,
        tools.sessionFinalizeCloseParamScheme,
        async ({ channelId }) => asToolResult(tools.sessionFinalizeClose(channelId))
    );

    server.tool(
        tools.getRevenueToolName,
        tools.getRevenueToolDescription,
        tools.getRevenueParamScheme,
        async ({ address, tokenIdentifier, days }) => asToolResult(tools.getRevenue(address, tokenIdentifier, days))
    );

    server.tool(
        tools.getSpendToolName,
        tools.getSpendToolDescription,
        tools.getSpendParamScheme,
        async ({ address, tokenIdentifier, days }) => asToolResult(tools.getSpend(address, tokenIdentifier, days))
    );

    // Wire the MPP Middleware to intercept premium endpoints
    const underlyingServer = server.server;

    const PRICED_TOOLS: Record<string, McpToolPrice> = {
        "sendEgld": { amount: "0.001", currency: "EGLD", intent: "charge" }, // Default 0.001 EGLD fee for using this tool via agent
        "sendTokens": { amount: "0.001", currency: "EGLD", intent: "charge" },
        "searchProducts": { amount: "0.01", currency: "EGLD", intent: "session", duration: "1h" },
        "searchAgents": { amount: "0.01", currency: "EGLD", intent: "session", duration: "1h" }
    };

    const mpp = createMppMiddleware(underlyingServer, PRICED_TOOLS, {
        networkProviderUrl: process.env.NETWORK_URL || "https://devnet-api.multiversx.com",
        paymentReceiverAddress: process.env.FEE_RECEIVER_ADDRESS || "erd1qqqqqqqqqqqqqpgq...fee_address...qqqqqqqqqqqqq" 
    });

    // @ts-ignore - Patching internal MCP handler
    const originalHandler = underlyingServer._requestHandlers.get("tools/call");
    // @ts-ignore
    underlyingServer._requestHandlers.set("tools/call", async (request: CallToolRequest, extra: unknown) => {
        return mpp(request, async (req) => {
            return originalHandler ? originalHandler(req, extra) : null;
        });
    });

    // @ts-ignore - Patching internal MCP handler
    const originalListHandler = underlyingServer._requestHandlers.get("tools/list");
    // @ts-ignore
    underlyingServer._requestHandlers.set("tools/list", async (request: CallToolRequest, extra: unknown) => {
        const result: any = await (originalListHandler ? originalListHandler(request, extra) : { tools: [] });
        if (result && Array.isArray(result.tools)) {
            for (const tool of result.tools) {
                const price = PRICED_TOOLS[tool.name];
                if (price) {
                    const paymentInfo = {
                        intent: price.intent || "charge",
                        method: "multiversx",
                        amount: price.amount,
                        currency: price.currency,
                        description: `Price: ${price.amount} ${price.currency}`
                    };
                    tool.description = (tool.description || "") + `\n\nPayment Required:\n\`x-payment-info\`: ${JSON.stringify(paymentInfo)}`;
                }
            }
        }
        return result;
    });

    return server;
}
