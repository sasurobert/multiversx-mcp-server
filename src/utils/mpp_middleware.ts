import { McpError, ErrorCode, CallToolRequest } from "@modelcontextprotocol/sdk/types.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ApiNetworkProvider } from "@multiversx/sdk-network-providers";

export interface McpToolPrice {
  intent?: "charge" | "session";
  amount: string;
  currency: string;
  recipient?: string;
  decimals?: number;
  duration?: string;
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
  const validSessions = new Map<string, { expiresAt: number }>();
  const usedCharges = new Set<string>();

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

    if (_mpp_payment_proof) {
      if (price.intent === "session" && validSessions.has(_mpp_payment_proof)) {
        const session = validSessions.get(_mpp_payment_proof);
        if (session && session.expiresAt > Date.now() / 1000) {
          if (request.params.arguments) delete request.params.arguments["_mpp_payment_proof"];
          return next(request);
        }
        validSessions.delete(_mpp_payment_proof); // Expired
      }
    }

    if (!_mpp_payment_proof) {
      const intent = price.intent || "charge";
      const requestOptions = {
        recipient: price.recipient || options.paymentReceiverAddress,
        amount: price.amount,
        currency: price.currency,
        decimals: price.decimals || options.defaultDecimals || 18,
        meta: { correlationId: toolName + "_" + Date.now().toString() },
      };

      let handler;
      if (intent === "session") {
        handler = (mppxInstance as any).session({
          ...requestOptions,
          duration: price.duration || "1h"
        });
      } else {
        handler = (mppxInstance as any).charge(requestOptions);
      }

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

      if (price.intent !== "session") {
        if (usedCharges.has(_mpp_payment_proof)) {
          throw new Error("Payment proof already used");
        }
        usedCharges.add(_mpp_payment_proof);
      } else {
        let durationSeconds = 3600;
        if (price.duration) {
          if (price.duration.endsWith('h')) durationSeconds = parseInt(price.duration) * 3600;
          else if (price.duration.endsWith('m')) durationSeconds = parseInt(price.duration) * 60;
          else if (price.duration.endsWith('d')) durationSeconds = parseInt(price.duration) * 86400;
        }
        const expiresAt = txOnNetwork.timestamp + durationSeconds;
        if (expiresAt < Date.now() / 1000) {
            throw new Error("Session has expired");
        }
        validSessions.set(_mpp_payment_proof, { expiresAt });
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
