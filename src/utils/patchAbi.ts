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
        .replace(/"TokenId"/g, '"TokenIdentifier"')
        .replace(/"NonZeroBigUint"/g, '"BigUint"');
    return Abi.create(JSON.parse(patched));
}
