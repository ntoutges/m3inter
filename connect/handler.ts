/**
 * Byte-stream transport abstraction (currently Web Serial).
 *
 * This module provides a unified interface for establishing a connection to a
 * raw byte stream (e.g. USB serial device) and consuming incoming data via:
 *
 *  - Raw callbacks (per chunk received)
 *  - Accumulated callbacks (buffered by size and/or idle timeout)
 *
 * It also exposes a minimal handle for writing bytes and closing the connection.
 *
 * Design goals:
 *  - Zero protocol assumptions (pure byte stream)
 *  - Optional lightweight framing (size / idle-time based)
 *  - Safe lifecycle management (clean shutdown, error handling)
 *
 * Current implementation:
 *  - Web Serial API (navigator.serial)
 *
 * Future extensions may include:
 *  - Socket (WebSockets, TCP)
 */

// NOTE:
// This abstraction does NOT implement:
//  - Message framing (newline, COBS, etc.)
//  - Retries or reconnect logic
//  - Backpressure handling
//
// These should be implemented on top of this layer.

/**
 * Callback invoked with raw byte chunks as they are received.
 * Note: chunk boundaries are transport-dependent and not guaranteed
 * to align with logical messages.
 */
type raw_cb_t = (bytes: Uint8Array) => void;

export type msg_cb_t = {
    /**
     * Called for every chunk of bytes received from the transport.
     * This is the lowest-level access to incoming data.
     */
    raw?: raw_cb_t;

    /**
     * Optional accumulation layer.
     *
     * Buffers incoming bytes and emits them as a single chunk based on:
     *  - `bytes`: when the buffer reaches this size
     *  - `timeout`: when no new data arrives for this duration (ms) (set to 0 to disable)
     *
     * This is useful for:
     *  - Packet-like protocols without explicit delimiters
     *  - Reducing callback frequency
     */
    acc?: {
        /** Called when the accumulator flushes */
        cb: raw_cb_t;

        /** Idle timeout (ms) before flushing. 0 disables timeout-based flushing */
        timeout: number;

        /** Maximum buffer size before immediate flush */
        bytes: number;
    };

    /**
     * Called when the connection is closed or the read loop terminates.
     * This will fire on:
     *  - Manual close()
     *  - Device disconnect
     *  - Read errors
     */
    close: () => void;
};

/**
 * Base connection handle shared across all transport types.
 */
type base_handle_t = {
    /**
     * Gracefully close the connection and release all resources.
     * Safe to call multiple times.
     */
    close: () => Promise<void>;

    /**
     * Write raw bytes to the underlying transport.
     * Errors are handled internally and logged.
     */
    write: raw_cb_t;
};

/**
 * Handle for a Web Serial connection.
 */
type serial_handle_t = {
    type: "serial";

    /**
     * Human-readable identifier for the connected device.
     * (May be derived from USB vendor/product info when available)
     */
    port: string;
} & base_handle_t;

/**
 * Union of all supported transport handles.
 * (Currently only serial, but structured for future expansion)
 */
export type handle_t = serial_handle_t;

/**
 * Establish a connection to a serial device using the Web Serial API.
 *
 * This will:
 *  1. Prompt the user to select a serial port
 *  2. Open the port with a default configuration (115200 baud)
 *  3. Start an asynchronous read loop
 *  4. Dispatch incoming data via the provided callbacks
 *
 * Data Flow:
 *  - Incoming bytes are first passed to `cb.raw` (if provided)
 *  - Then optionally buffered and emitted via `cb.acc`
 *
 * Lifecycle:
 *  - The connection remains active until:
 *      • `handle.close()` is called
 *      • The device disconnects
 *      • A read error occurs
 *  - In all cases, `cb.close()` will be invoked
 *
 * @param cb Callback configuration for handling incoming data and lifecycle events
 *
 * @returns
 *  - On success: a `serial_handle_t` for interacting with the connection
 *  - On failure: a string describing the error condition
 *
 * @remarks
 *  - Requires a secure context (HTTPS or localhost)
 *  - Must be triggered by a user gesture (browser requirement)
 *  - Chunk boundaries from `raw` are not guaranteed to match logical messages
 */
export async function handleSerial(
    cb: msg_cb_t,
): Promise<string | serial_handle_t> {
    if (!("serial" in navigator)) {
        return "Web Serial API not supported";
    }

    let port: SerialPort;

    try {
        navigator.serial;
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
    } catch (err) {
        return "User cancelled or failed to open port";
    }

    const reader = port.readable!.getReader();
    const writer = port.writable!.getWriter();

    let running = true;

    // Accumulator state
    let accBuffer: number[] = [];
    let accTimer: number | null = null;

    function flushAccumulator() {
        if (!cb.acc || accBuffer.length === 0) return;

        const data = new Uint8Array(accBuffer);
        accBuffer = [];

        cb.acc.cb(data);
    }

    function scheduleTimeout() {
        if (!cb.acc || cb.acc.timeout === 0) return;

        if (accTimer !== null) {
            clearTimeout(accTimer);
        }

        accTimer = window.setTimeout(() => {
            flushAccumulator();
            accTimer = null;
        }, cb.acc.timeout);
    }

    // Read loop
    (async () => {
        try {
            while (running) {
                const { value, done } = await reader.read();

                if (done) break;
                if (!value) continue;

                // Raw callback
                if (cb.raw) {
                    cb.raw(value);
                }

                // Accumulator logic
                if (cb.acc) {
                    for (const byte of value) {
                        accBuffer.push(byte);

                        if (accBuffer.length === cb.acc.bytes) {
                            flushAccumulator();
                        }
                    }

                    scheduleTimeout();
                }
            }
        } catch (err) {
            console.error("Read loop error:", err);
        } finally {
            cb.close();
        }
    })();

    async function close() {
        if (!running) return;
        running = false;

        try {
            if (accTimer !== null) {
                clearTimeout(accTimer);
                accTimer = null;
            }

            flushAccumulator();

            await reader.cancel();
            reader.releaseLock();

            await writer.close();
            writer.releaseLock();

            await port.close();
        } catch (err) {
            console.warn("Error during stop:", err);
        }
    }

    return {
        type: "serial",
        port: "@TODO",
        close,
        write: (bytes: Uint8Array) => {
            writer.write(bytes).catch((err) => {
                console.error("Write error:", err);
            });
        },
    };
}
