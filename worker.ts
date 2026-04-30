/**
 * Worker to run arbitrary user code
 *
 * @todo Add puppet interactors for proper WebWorker support
 * @todo Fill out this file with the requisite information to load/run commands
 */

import { execute, onBridgeRx } from "./executor.js";

function handleMessage(ev: MessageEvent) {
    switch (ev.data.type) {
        // Code to run
        case "code":
            runCode(ev.data.code);
            break;

        case "msg":
            onBridgeRx(ev.data.msg);
            break;
    }
}

async function runCode(code: string) {
    try {
        await execute(code);

        // Indicate success!
        postMessage({ type: "done" });
    } catch (err) {
        // Failed to run code... requesting termination
        postMessage({
            type: "error",
            error: err instanceof Error ? err.toString() : err,
        });
    }
}

self.onmessage = handleMessage;
