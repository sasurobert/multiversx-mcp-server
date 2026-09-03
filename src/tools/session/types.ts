import { z } from "zod";

export const sessionOpenParamScheme = {
    receiver: z.string().describe("The bech32 address of the receiver (provider)"),
    amount: z.string().describe("The amount to lock in escrow (in atomic units)"),
    tokenIdentifier: z.string().optional().describe("The token identifier (EGLD if omitted)"),
    deadline: z.number().optional().describe("Settlement deadline (seconds from now, default 24h)")
};

export const sessionPayParamScheme = {
    channelId: z.string().describe("The hexadecimal channel ID"),
    amount: z.string().describe("The new cumulative total amount authorized"),
    nonce: z.number().describe("The incrementing voucher nonce"),
    facilitatorUrl: z.string().describe("The URL of the MPP Facilitator to submit the voucher to")
};

export const sessionSettleParamScheme = {
    channelId: z.string().describe("The hexadecimal channel ID"),
    facilitatorUrl: z.string().describe("The URL of the MPP Facilitator to get the latest voucher from")
};

export const sessionCloseParamScheme = {
    channelId: z.string().describe("The hexadecimal channel ID"),
    facilitatorUrl: z.string().describe("The URL of the MPP Facilitator to get the latest voucher from")
};

export const sessionRequestCloseParamScheme = {
    channelId: z.string().describe("The hexadecimal channel ID")
};

export const sessionFinalizeCloseParamScheme = {
    channelId: z.string().describe("The hexadecimal channel ID")
};
