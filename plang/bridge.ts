/**
 * A bridge used to communicate between the worker threads and the main thread
 */

import { PuppetInteractor } from "./interactor";

type BridgeMessage =
    | { type: "create"; pid: number; class: string; args: any[] }
    | { type: "created"; pid: number }
    | { type: "call"; pid: number; mid: number; method: string; args: any[] }
    | { type: "resolve"; mid: number; result: any }
    | { type: "reject"; mid: number; error?: any }
    | { type: "destroy"; pid: number }
    | { type: "reset" };

type Pending = {
    resolve: (v: any) => void;
    reject: (e?: any) => void;
};

type Factory = (...args: any[]) => any;

let txCb: ((msg: BridgeMessage) => void) | null = null;

function send(msg: BridgeMessage) {
    if (!txCb) {
        throw new Error("Bridge TX not registered");
    }
    txCb(msg);
}

let nextMid = 1;

const objects = new Map<number, any>();
const pending = new Map<number, Pending>();
const registry = new Map<string, Factory>();

export function registerPuppetClass(name: string, factory: Factory) {
    registry.set(name, factory);
}

/**
 * Create new object via bridge
 * @param pid           The id of hte object to create
 * @param className     The object type to create
 * @param args          The arguments to create the object with
 */
export function bridgeCreate(pid: number, className: string, args: any[]) {
    args = compressPuppetArgs(args);

    send({ type: "create", pid, class: className, args });
}

/**
 * Destroy some object via the bridge
 * @param pid           The id of hte object to create
 */
export function bridgeDestroy(pid: number) {
    send({ type: "destroy", pid });
}

/**
 * Clear all objects on the other side of the bridge
 */
export function bridgeReset() {
    send({ type: "reset" });

    // Also clean local pending
    for (const p of pending.values()) {
        p.reject("Bridge reset");
    }
    pending.clear();
}

/**
 * Call some function of an object via bridge
 * @param pid       The id of the object to use
 * @param method    The method to call
 * @param args      The arguments to pass into the method
 * @returns         A promise that resolves/rejects on method resolution
 */
export function bridgeCall(
    pid: number,
    method: string,
    args: any[],
): Promise<any> {
    const mid = nextMid++;

    args = compressPuppetArgs(args);

    return new Promise((resolve, reject) => {
        pending.set(mid, { resolve, reject });

        send({
            type: "call",
            pid,
            mid,
            method,
            args,
        });
    });
}

export function onBridgeTx(cb: (msg: BridgeMessage) => void) {
    txCb = cb;
}

export function onBridgeRx(msg: BridgeMessage) {
    // Notation: A -> B
    switch (msg.type) {
        // B Side
        case "create": {
            const factory = registry.get(msg.class);
            if (!factory) {
                console.warn(`Unknown puppet class: ${msg.class}`);
                return;
            }

            let args = extractPuppetArgs(msg.args);
            if (args === null) {
                console.error("Failed to extract args in `create`");
                args = msg.args;
            }

            const obj = factory(...args);
            objects.set(msg.pid, obj);

            send({ type: "created", pid: msg.pid });
            break;
        }

        // B Side
        case "call": {
            const obj = objects.get(msg.pid);
            if (!obj) {
                send({
                    type: "reject",
                    mid: msg.mid,
                    error: "Invalid pid",
                });
                return;
            }

            const args = extractPuppetArgs(msg.args);
            if (args === null) {
                send({
                    type: "reject",
                    mid: msg.mid,
                    error: "Unable to extract args in `call`",
                });
                return;
            }

            try {
                const result = obj[msg.method](...args);

                Promise.resolve(result)
                    .then((res) =>
                        send({ type: "resolve", mid: msg.mid, result: res }),
                    )
                    .catch((err) =>
                        send({ type: "reject", mid: msg.mid, error: err }),
                    );
            } catch (err) {
                send({ type: "reject", mid: msg.mid, error: err });
            }

            break;
        }

        // A Side
        case "resolve": {
            const p = pending.get(msg.mid);
            if (!p) return;

            p.resolve(msg.result);
            pending.delete(msg.mid);
            break;
        }

        // A Side
        case "reject": {
            const p = pending.get(msg.mid);
            if (!p) return;

            p.reject(msg.error);
            pending.delete(msg.mid);
            break;
        }

        // B Side
        case "destroy": {
            objects.delete(msg.pid);
            break;
        }

        // B Side
        case "reset": {
            objects.clear();

            for (const p of pending.values()) {
                p.reject("Bridge reset");
            }
            pending.clear();

            break;
        }

        // A Side
        case "created":
            // optional: handshake support
            break;
    }
}

/**
 * Convert any arguments that are PuppetInteractor instances into references that can safely be sent
 * @param args
 * @returns
 */
function compressPuppetArgs(args: any[]): any[] {
    const a: any[] = [];
    for (const arg of args) {
        // Change actual instance of puppet to reference
        if (arg instanceof PuppetInteractor) {
            a.push({
                __$PUPPET__: arg.pid,
            });
        } else a.push(arg);
    }

    return a;
}

/**
 * Convert any object with the one field __$PUPPET__ into the puppet that that references
 */
function extractPuppetArgs(a: any[]): any[] | null {
    const args: any[] = [];
    for (const arg of a) {
        // Reference to existing object
        if (
            Object.keys(arg).length === 1 &&
            Object.hasOwn(arg, "__$PUPPET__") &&
            typeof arg.__$PUPPET__ === "number"
        ) {
            const obj = objects.get(arg.__$PUPPET__);

            if (!obj) {
                return null;
            }

            args.push(obj);
        } else args.push(arg);
    }

    return args;
}
