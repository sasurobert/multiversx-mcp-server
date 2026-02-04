"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = require("../http");
const searchProducts_1 = require("../tools/searchProducts");
// Mock the searchProducts tool
jest.mock("../tools/searchProducts");
jest.mock("../utils/whitelistRegistry", () => ({
    loadWhitelist: jest.fn().mockReturnValue(["COL-1"])
}));
describe("HTTP Server", () => {
    let fastify;
    beforeAll(async () => {
        fastify = (0, http_1.createHttpServer)();
        await fastify.ready();
    });
    afterAll(async () => {
        await fastify.close();
    });
    it("should return UCP manifest", async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/.well-known/ucp'
        });
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body).toHaveProperty("name", "MultiversX Agent Connector");
    });
    it("should return health status", async () => {
        const response = await fastify.inject({
            method: 'GET',
            url: '/health'
        });
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe("ok");
    });
    it("should return product feed", async () => {
        searchProducts_1.searchProducts.mockResolvedValue({
            content: [{
                    type: "text",
                    text: JSON.stringify([{
                            id: "P-1",
                            name: "Product 1",
                            description: "Desc",
                            image_url: "img",
                            availability: "in_stock",
                            price: "10 EGLD"
                        }])
                }]
        });
        const response = await fastify.inject({
            method: 'GET',
            url: '/feed.json'
        });
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.items).toHaveLength(1);
        expect(body.items[0].id).toBe("P-1");
    });
});
