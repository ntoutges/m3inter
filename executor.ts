/**
 * Execute interactor code
 */

import { createPCamInteractor } from "./plang/cam.js";
import { createPObjInteractor } from "./plang/obj.js";
import { createPSegInteractor } from "./plang/seg.js";
import { Vec3, Quat } from "./plang/prim.js";
import { onBridgeTx } from "./plang/bridge.js";

export { onBridgeRx } from "./plang/bridge.js";

onBridgeTx((msg) => {
    postMessage({ type: "msg", msg });
});

const OBJ = createPObjInteractor;
const SEG = createPSegInteractor;
const cam = createPCamInteractor();

// Color definitions
const FULL = 3;
const DIM = 2;
const DARK = 1;
const INVISIBLE = 0;

const VEC = (x: number, y: number, z: number) => new Vec3(x, y, z);
const QUAT = (x: number, y: number, z: number, w: number) =>
    new Quat(x, y, z, w);

QUAT.fromDirection = Quat.fromDirection;

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
    cam.clear();
}

export const env = {
    OBJ,
    SEG,
    VEC,
    QUAT,
    sleep,
    clear,
    cam,

    FULL,
    DIM,
    DARK,
    INVISIBLE,
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
