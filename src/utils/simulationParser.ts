/**
 * Robust parser for simulation responses across all MultiversX provider formats.
 *
 * Handles 4 response variants:
 *
 * Format 1 — API (flattened):
 *   { status: { status: "success" } }
 *
 * Format 2 — Proxy/Gateway (nested under `raw`):
 *   { raw: { status: "success", receiverShard: { status: "..." }, senderShard: { status: "..." } } }
 *
 * Format 3a — Chain Simulator, same-shard (nested under `result`):
 *   { result: { status: "success" } }
 *
 * Format 3b — Chain Simulator, cross-shard (nested under `result`):
 *   { result: { receiverShard: { status: "success" }, senderShard: { status: "success" } } }
 */
export function parseSimulationResult(result: Record<string, any>): { success: boolean; errorMessage: string } {
    if (!result) {
        return { success: false, errorMessage: 'Empty simulation result' };
    }

    // Format 1: flattened API — { status: { status: "success" } }
    const statusFromStatus = result?.status?.status;
    if (statusFromStatus === 'success') {
        return { success: true, errorMessage: '' };
    }

    // Format 2: proxy/gateway — { raw: { status: "success", ... } }
    const statusFromRaw = result?.raw?.status;
    if (statusFromRaw === 'success') {
        return { success: true, errorMessage: '' };
    }

    // Execution result (can be nested either way)
    const execution = result?.execution || result?.result?.execution;
    if (execution?.result === 'success') {
        return { success: true, errorMessage: '' };
    }

    // Format 2 shard-level check under `raw`
    const rawReceiverShard = result?.raw?.receiverShard?.status;
    const rawSenderShard = result?.raw?.senderShard?.status;
    if (rawReceiverShard === 'success' && (!rawSenderShard || rawSenderShard === 'success')) {
        return { success: true, errorMessage: '' };
    }

    // Format 3a: chain simulator same-shard — { result: { status: "success" } }
    const statusFromResult = result?.result?.status;
    if (statusFromResult === 'success') {
        return { success: true, errorMessage: '' };
    }

    // Format 3b: chain simulator cross-shard — { result: { receiverShard: { status }, senderShard: { status } } }
    const resultReceiverShard = result?.result?.receiverShard?.status;
    const resultSenderShard = result?.result?.senderShard?.status;
    if (resultReceiverShard === 'success' && (!resultSenderShard || resultSenderShard === 'success')) {
        return { success: true, errorMessage: '' };
    }

    // All checks failed — extract best error message
    const errorMessage =
        execution?.message ||
        result?.error ||
        result?.raw?.error ||
        result?.result?.error ||
        statusFromStatus ||
        statusFromRaw ||
        'Unknown error';
    return { success: false, errorMessage };
}
