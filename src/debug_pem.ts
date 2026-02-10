import { UserSecretKey } from "@multiversx/sdk-wallet";
import * as fs from "fs";

try {
    const pemPath = process.argv[2];
    if (!pemPath) throw new Error("Provide pem path");
    const pem = fs.readFileSync(pemPath, "utf-8");
    console.log("Read PEM length:", pem.length);
    const sk = UserSecretKey.fromPem(pem);
    console.log("Success! Address:", sk.generatePublicKey().toAddress().bech32());
} catch (e) {
    console.error("Error:", e);
}
