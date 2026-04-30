/**
 * Execute interactor code
 */

import { CamInteractor } from "./plang/cam.js";
import { createPObjInteractor } from "./plang/obj.js";
import { createPSegInteractor } from "./plang/seg.js";
import { Vec3, Quat } from "./plang/prim.js";

export const cam = new CamInteractor();

const OBJ = createPObjInteractor;
const SEG = createPSegInteractor;

const VEC = (x: number, y: number, z: number) => new Vec3(x, y, z);
const QUAT = (x: number, y: number, z: number, w: number) =>
    new Quat(x, y, z, w);

/**
 * Sleep for some number of ms
 * @param ms
 */
function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

/**
 * Clear the scene of _all_ objects
 */
function clear() {
    // @TODO
}

const env = {
    OBJ,
    SEG,
    VEC,
    QUAT,
    sleep,
    clear,
};

/**
 * Execute some set of commands
 * @param commands  The JS commands to execute
 */
export function execute(commands: string) {
    const envKeys = Object.keys(env);
    const envValues = envKeys.map((k) => (env as any)[k]);

    const AsyncFn = async function () {}.constructor;

    // Define and run arbitrary code in the special environment
    return AsyncFn(...envKeys, commands)(...envValues);
}
