import { Abi } from "@multiversx/sdk-core";

/**
 * Creates an Abi instance from a JSON object, patching type aliases
 * that sdk-core's TypeMapper doesn't recognize.
 *
 * Currently patches:
 * - TokenId → TokenIdentifier
 * - NonZeroBigUint → BigUint
 */
export function createPatchedAbi(abiJson: Record<string, unknown>): Abi {
    const raw = JSON.stringify(abiJson);
    const patched = raw
        .replace(/\bTokenId\b/g, 'TokenIdentifier')
        .replace(/\bNonZeroBigUint\b/g, 'BigUint')
        .replace(/\bPayment\b/g, 'EgldOrEsdtTokenPayment');
    return Abi.create(JSON.parse(patched));
}
