/**
 * A bridge used to communicate between the worker threads and the main thread
 */

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
    console.log("Sending", msg);
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

            const obj = factory(...msg.args);
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

            try {
                const result = obj[msg.method](...msg.args);

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
