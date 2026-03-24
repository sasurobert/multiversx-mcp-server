import { z } from "zod";
import { ToolResult } from "../types";
import { loadNetworkConfig } from "../networkConfig";

export const getRevenueToolName = "mpp:analytics:get_revenue";
export const getRevenueToolDescription = "Get the total revenue (incoming funds) for an agent address over a specific time period using MultiversX Elasticsearch.";

export const getRevenueParamScheme = {
    address: z.string().describe("The MultiversX address of the agent"),
    tokenIdentifier: z.string().optional().describe("The token identifier (e.g. EGLD). Defaults to EGLD."),
    days: z.number().optional().describe("Number of days to look back. Defaults to 30.")
};

async function queryElasticSearch(address: string, days: number, isRevenue: boolean): Promise<number> {
    const config = loadNetworkConfig();
    const lookbackSeconds = days * 24 * 60 * 60;
    const afterTimestamp = Math.floor(Date.now() / 1000) - lookbackSeconds;
    
    // Revenue = incoming (receiver), Spend = outgoing (sender)
    const roleField = isRevenue ? "receiver" : "sender";

    const query: any = {
        size: 1000,
        query: {
            bool: {
                must: [
                    { match: { [roleField]: address } },
                    { match: { status: "success" } },
                    { range: { timestamp: { gte: afterTimestamp } } }
                ],
                must_not: [
                    { match: { sender: address } } // For revenue, ensure it's not a self-transfer hiding as revenue. Wait, let's keep it simple.
                ]
            }
        }
    };

    if (isRevenue) {
        query.query.bool.must_not = [{ match: { sender: address } }];
    } else {
        query.query.bool.must_not = [{ match: { receiver: address } }];
    }

    try {
        const response = await fetch(`${config.apiUrl}/elastic/transactions/_search`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(query)
        });

        if (!response.ok) {
            throw new Error(`Elasticsearch query failed: ${response.statusText}`);
        }

        const data = await response.json();
        const hits = data?.hits?.hits || [];
        
        let totalValue = BigInt(0);
        for (const hit of hits) {
            const val = hit._source?.value;
            if (val) {
                totalValue += BigInt(val);
            }
        }

        // Convert from WEGLD to EGLD (18 decimals)
        return Number(totalValue) / 1e18;
    } catch (error: any) {
        console.error("Error querying ES:", error);
        throw error;
    }
}

export async function getRevenue(address: string, tokenIdentifier: string = "EGLD", days: number = 30): Promise<ToolResult> {
    try {
        if (tokenIdentifier !== "EGLD") {
            return { content: [{ type: "text", text: "Currently only EGLD revenue tracking is supported in this basic version." }] };
        }
        
        const totalEgld = await queryElasticSearch(address, days, true);
        return {
            content: [{ type: "text", text: `Revenue for ${address} over the last ${days} days: ${totalEgld} ${tokenIdentifier}` }]
        };
    } catch (error: any) {
        return { content: [{ type: "text", text: `Failed to calculate revenue: ${error.message}` }] };
    }
}

export const getSpendToolName = "mpp:analytics:get_spend";
export const getSpendToolDescription = "Get the total spend (outgoing funds) for an agent address over a specific time period using MultiversX Elasticsearch.";

export const getSpendParamScheme = {
    address: z.string().describe("The MultiversX address of the agent"),
    tokenIdentifier: z.string().optional().describe("The token identifier (e.g. EGLD). Defaults to EGLD."),
    days: z.number().optional().describe("Number of days to look back. Defaults to 30.")
};

export async function getSpend(address: string, tokenIdentifier: string = "EGLD", days: number = 30): Promise<ToolResult> {
    try {
        if (tokenIdentifier !== "EGLD") {
            return { content: [{ type: "text", text: "Currently only EGLD spend tracking is supported in this basic version." }] };
        }
        
        const totalEgld = await queryElasticSearch(address, days, false);
        return {
            content: [{ type: "text", text: `Spend for ${address} over the last ${days} days: ${totalEgld} ${tokenIdentifier}` }]
        };
    } catch (error: any) {
        return { content: [{ type: "text", text: `Failed to calculate spend: ${error.message}` }] };
    }
}
