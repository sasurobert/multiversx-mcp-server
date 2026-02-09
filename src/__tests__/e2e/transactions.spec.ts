import { test, expect } from "@playwright/test";
import { createE2eClient } from "./harness";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test.describe("Transaction tools E2E", () => {
    let client: Client;
    let transport: StdioClientTransport;

    test.beforeAll(async () => {
        const result = await createE2eClient({ MVX_SIGNING_MODE: "unsigned" });
        client = result.client;
        transport = result.transport;
    });

    test.afterAll(async () => {
        if (transport) {
            await transport.close();
        }
    });

    test("send-egld returns unsigned transaction template", async () => {
        const result = await client.callTool({
            name: "send-egld",
            arguments: {
                receiver: "erd1qyu5wfcjeh9d2lcc3wy5e9un7vp767jld437v6t69x64z9p7hnaqsxc7kr",
                amount: "1000000000000000000"
            }
        });

        // The tool returns a plain object with 'content' as text array
        const text = result.content[0].text;
        expect(text).toContain("Unsigned transaction");
        expect(text).toContain("receiver");
    });

    test("issue-fungible-token returns message about signing mode", async () => {
        const result = await client.callTool({
            name: "issue-fungible-token",
            arguments: {
                tokenName: "TestToken",
                tokenTicker: "TST",
                initialSupply: "1000",
                numDecimals: 18
            }
        });

        expect(result.content[0].text).toContain("Signing mode required");
    });
});
