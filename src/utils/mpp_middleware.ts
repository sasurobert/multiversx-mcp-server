import { McpError, ErrorCode, CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";

export interface McpToolPrice {
  amount: string;
  currency: string;
  recipient?: string;
  decimals?: number;
}

export interface McpPaymentMiddlewareOptions {
  networkProviderUrl: string;
  paymentReceiverAddress: string;
  defaultDecimals?: number;
  facilitatorUrl?: string; // Optional
}

export function createMppMiddleware(
  server: Server,
  pricedTools: Record<string, McpToolPrice>,
  options: McpPaymentMiddlewareOptions
) {
  const provider = new ApiNetworkProvider(options.networkProviderUrl);
  let mppxInstance: unknown = null;

  return async (request: CallToolRequest, next: (req: CallToolRequest) => Promise<any>) => {
    const toolName = request.params.name;
    const price = pricedTools[toolName];

    if (!price) {
      return next(request);
    }

    if (!mppxInstance) {
      const { Mppx, Transport } = await import("mppx/server");
      const { multiversx } = await import("mppx-multiversx/server");

      const mppxMethod = multiversx({
          decimals: options.defaultDecimals || 18,
          chainId: "D",
          currency: "EGLD",
          verifyTransaction: async () => { return { success: false }; } // dummy inline, verification done outside
      });

      mppxInstance = Mppx.create({
          methods: [mppxMethod],
          realm: "mcp-agentic",
          secretKey: "agent_secret_key",
          transport: Transport.mcpSdk()
      });
    }

    const _mpp_payment_proof = request.params.arguments?.["_mpp_payment_proof"] as string | undefined;

    if (!_mpp_payment_proof) {
      const handler = (mppxInstance as any).charge({
        recipient: price.recipient || options.paymentReceiverAddress,
        amount: price.amount,
        currency: price.currency,
        decimals: price.decimals || options.defaultDecimals || 18,
        meta: { correlationId: toolName + "_" + Date.now().toString() },
      });

      const result = await handler({});
      if (result.status === 402) {
        throw result.challenge;
      }
      throw new McpError(ErrorCode.InternalError, "Expected payment challenge");
    }

    try {
      const txOnNetwork = await provider.getTransaction(_mpp_payment_proof!);
      if (txOnNetwork.status.isFailed() || txOnNetwork.status.isPending()) {
        throw new Error("Transaction is not successful");
      }

      if (txOnNetwork.receiver.bech32() !== (price.recipient || options.paymentReceiverAddress)) {
          throw new Error("Invalid payment recipient");
      }
      
      if (request.params.arguments) {
          delete request.params.arguments["_mpp_payment_proof"];
      }
      return next(request);

    } catch (e: unknown) {
      throw new McpError(ErrorCode.InvalidParams, `Invalid Payment Proof: ${(e as Error).message}`);
    }
  };
}
