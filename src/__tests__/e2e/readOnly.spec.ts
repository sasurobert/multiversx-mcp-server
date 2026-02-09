import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test.describe("Read-only tools E2E", () => {
    let client: Client;
    let transport: StdioClientTransport;

    test.beforeAll(async () => {
        const result = await createE2eClient();
        client = result.client;
        transport = result.transport;
    });

    test.afterAll(async () => {
        if (transport) {
            await transport.close();
        }
    });

    test("get-balance tool returns balance for valid address", async () => {
        const result = await client.callTool({
            name: "get-balance",
            arguments: { address: "erd1qyu5wfcjeh9d2lcc3wy5e9un7vp767jld437v6t69x64z9p7hnaqsxc7kr" }
        });

        expect(result.content).toBeDefined();
        expect(result.content[0].type).toBe("text");
        expect(result.content[0].text).toContain("EGLD");
    });

    test("query-account tool returns detailed account info", async () => {
        const result = await client.callTool({
            name: "query-account",
            arguments: { address: "erd1qyu5wfcjeh9d2lcc3wy5e9un7vp767jld437v6t69x64z9p7hnaqsxc7kr" }
        });

        const details = JSON.parse(result.content[0].text);
        expect(details.address).toBe("erd1qyu5wfcjeh9d2lcc3wy5e9un7vp767jld437v6t69x64z9p7hnaqsxc7kr");
        expect(details.balance).toBeDefined();
        expect(details.nonce).toBeDefined();
    });
});
