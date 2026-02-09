import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

test.describe("Advanced tools E2E", () => {
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

    test("search-products returns NFT results from public API", async () => {
        const result = await client.callTool({
            name: "search-products",
            arguments: { query: "MultiversX", limit: 2 }
        });

        const products = JSON.parse(result.content[0].text);
        expect(Array.isArray(products)).toBe(true);
        if (products.length > 0) {
            expect(products[0].id).toBeDefined();
            expect(products[0].metadata).toBeDefined();
        }
    });

    test("track-transaction returns simplified status", async () => {
        const result = await client.callTool({
            name: "track-transaction",
            arguments: { txHash: "0000000000000000000000000000000000000000000000000000000000000000" }
        });

        const status = JSON.parse(result.content[0].text);
        expect(status.status).toBeDefined();
    });
});
