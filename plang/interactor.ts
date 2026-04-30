/**
 * Define a base class used to interact with the renderer via a `cmd` interface
 */

import { bridgeCall, bridgeCreate, bridgeDestroy } from "./bridge";
export { onBridgeRx, onBridgeTx, registerPuppetClass } from "./bridge"; // Export main bridge callbacks

/**
 * Id of the last request sent. In the range [0, 64)
 */
let rid: number = 0;

/**
 * Map outstanding requests to their associated promise data
 */
const outstanding = new Map<
    number,
    {
        resolve: (value: number | null) => void;
        reject: (reason?: any) => void;
        timeout?: ReturnType<typeof setTimeout>;
        dispatch: number;
    }
>();

/**
 * The callback to call when a command is to be sent. This will be set by the `onTx` function and called by `execCmd`
 */
let txCb: ((data: Uint8Array) => void) | null = null;

/**
 * The base class for implementing all renderer interaction classes
 */
export abstract class Interactor {
    private _timeout: number = 0;
    private _qstate: "queuing" | "success" | "fail" = "queuing";
    private _queue: {
        fn: (...args: any[]) => any;
        args: any[];
        resolve: (res: any) => void;
        reject: (res?: any) => void;
    }[] = [];

    // The base command
    private readonly _command: string;

    constructor(command: string) {
        this._command = command;
    }

    /**
     * Set the timeout for all subsequent commands
     * @param timeout   The timeout to wabt for a response to a command request
     */
    protected timeout(timeout: number) {
        this._timeout = timeout;
    }

    /**
     * Send a command to the renderer
     * @param subcmd   The command to send
     * @param args  The arguments to send with the command
     * @returns A promise that resolves with the response code or null on failure, or rejects on timeout
     */
    protected cmd(subcmd: string, ...args: any[]): Promise<number | null> {
        return execCmd(this._timeout, this._command, subcmd, ...args);
    }

    /**
     * Enqueue some operation to run once some condition is satisfied
     */
    protected queue<T extends any[], U>(
        fn: (...args: T) => U,
        ...args: T
    ): Promise<Awaited<U>> {
        return new Promise<Awaited<U>>((resolve, reject) => {
            if (this._qstate === "success") {
                const resp = fn.apply(this, args);

                // Attempt to resolve if PromiseLike
                if (
                    (typeof resp === "object" || typeof resp === "function") &&
                    typeof (resp as any).then === "function"
                )
                    (resp as any).then(resolve).catch(reject);
                else resolve(resp as Awaited<U>);

                return;
            } else if (this._qstate === "fail") {
                reject();
                return;
            }

            // Queue calls to functions
            this._queue.push({
                args,
                fn,
                resolve,
                reject,
            });
        });
    }

    /**
     * Indicate that the condition for enquing values has been reached
     * @param success   If true, resolve all outstanding requests. Ohterwise, reject
     */
    protected dequeue(success: boolean) {
        this._qstate = success ? "success" : "fail";

        // Run all queued functions
        for (const { args, fn, resolve, reject } of this._queue) {
            if (success) resolve(fn.apply(this, args));
            else reject();
        }

        // Empty queue
        this._queue.splice(1);
    }
}

let nextPid = 1;
export abstract class PuppetInteractor {
    readonly pid: number;

    constructor(className: string, ...args: any[]) {
        this.pid = nextPid++;

        bridgeCreate(this.pid, className, args);
    }

    protected call(method: string, ...args: any[]): Promise<any> {
        return bridgeCall(this.pid, method, args);
    }

    destroy() {
        bridgeDestroy(this.pid);
    }
}

/**
 * Execute a command and wait for response
 * @param timeout   The maximum time to wait for a response, in milliseconds. Set to 0 to disable timeout. (Note that tiemout condition can still trigger on rid exhaustion)
 * @param cmd   The command to send
 * @param args  Additional arguments to send with the command
 * @returns A promise that resolves with the response code or null on failure, or rejects on timeout
 */
export function execCmd(
    timeout: number,
    cmd: string,
    ...args: any[]
): Promise<number | null> {
    return new Promise((resolve, reject) => {
        if (!txCb) {
            console.error("No tx callback registered");
            reject("No tx callback registered");
            return;
        }

        // Search for an available request id
        let foundId = false;
        for (let i = 0; i < 64; i++) {
            rid = (rid + 1) % 64;

            if (!outstanding.has(rid)) {
                foundId = true;
                break;
            }
        }

        // Too many outstanding requests
        // This should _NEVER_ happen under normal circumstances...
        // Cause the earliest request to fail, freeing up the id
        if (!foundId) {
            // Look for minimum dispatch time
            let dispatch = Infinity;
            let id = 0;

            for (const [key, value] of outstanding) {
                if (value.dispatch < dispatch) {
                    dispatch = value.dispatch;
                    id = key;
                }
            }

            console.warn(
                `Exhausted all request ids. Rejecting oldest request with id ${id}`,
            );

            execReject(id);
            rid = id;
        }

        // Construct outstanding request data
        outstanding.set(rid, {
            resolve,
            reject,
            dispatch: performance.now(),
            timeout:
                timeout > 0
                    ? setTimeout(execReject.bind(null, rid), timeout)
                    : undefined,
        });

        // Construct string to send
        const strArgs = args
            .map((x) => (typeof x === "number" ? `+${x}` : x))
            .join(" ");

        const payload = `!${cmd} ${rid} ${strArgs}\n`;

        // Convert payload to ASCII bytes
        const bytes = new Uint8Array(payload.length);
        for (let i = 0; i < payload.length; i++) {
            bytes[i] = payload.charCodeAt(i);
        }

        // Tranxmit
        txCb(bytes);
    });
}

/**
 * Indicate that some request failed
 * @param id    The id of the request that failed
 */
function execReject(id: number) {
    const req = outstanding.get(id);

    if (!req) return; // Ignore invalid id

    if (req.timeout !== undefined) {
        clearTimeout(req.timeout);
    }

    req.reject();
    outstanding.delete(id);
    console.log(`REJECT ${id}`);
}

/**
 * Indicate that some request succeeded
 * @param id        The id of the request that succeeded
 * @param error     Whether the request returned with an error status
 * @param status    The status of the request
 * @returns         The time between dispatch and now, or null if invalid
 */
function execResolve(
    id: number,
    error: boolean,
    status: number,
): number | null {
    const req = outstanding.get(id);

    if (!req) return null; // Ignore invalid id

    if (req.timeout !== undefined) {
        clearTimeout(req.timeout);
    }

    req.resolve(error ? null : status);
    outstanding.delete(id);

    console.log(`RESOLVE ${id}`);
    return performance.now() - req.dispatch;
}

/**
 * Register a callback to be called when a command is to be sent
 * @param cb    The callabck to call when a command is to be sent
 * Note that only one callback will ever be registered
 */
export function onTx(cb: (data: Uint8Array) => void) {
    txCb = cb;
}

/**
 * Call this function to run whenever a command is received from the renderer
 * @param data  The received data
 * @returns     The latency between dispatch and now, or null if invalid
 */
export function onRx(data: Uint8Array): {
    latency: number | null;
    error: boolean;
    code: number;
} {
    if (data.length !== 2) return { latency: null, error: false, code: 0 }; // Expecting 2 bytes: [header, response]

    // Extract id + error status from data
    const header = data[0];

    const id = header & 0x3f; // Lower 6 bits are id
    const error = header & 0x40 ? true : false; // Bit 6 is error flag

    return {
        latency: execResolve(id, error, data[1]),
        error: error,
        code: data[1],
    };
}
