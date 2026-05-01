import { Connect } from "./connect/connect.js";
import {
    handle_t,
    handleSerial,
    handleSocket,
    msg_cb_t,
} from "./connect/handler.js";
import { Grid } from "./grid/grid.js";
import { config } from "./setup.json";
import { Stat } from "./stat/stat.js";
import {
    onTx,
    onRx,
    onBridgeRx,
    onBridgeTx,
    registerPuppetClass,
} from "./plang/interactor.js";
import { Quat, Vec3 } from "./plang/prim.js";
import { toast } from "./toast.js";
import { createObjInteractor } from "./plang/obj.js";
import { createSegInteractor } from "./plang/seg.js";
import { CamInteractor } from "./plang/cam.js";

const $ = document.querySelector.bind(document);
const bytes = 1024;

// Define elements as globals for ease-of-use
const devicePanel = $("#device-panel") as HTMLElement;
const portName = $("#com-port") as HTMLElement;
const statusWord = $("#connection-status") as HTMLElement;
const gizmo_canvas = $("#camera-gizmo") as HTMLCanvasElement;
const gizmo_ctx = gizmo_canvas.getContext("2d")!;
const commandInput = $("#command-input") as HTMLTextAreaElement;
const commandDisplay = $("#command-display") as HTMLElement;
const commandButton = $("#run-command") as HTMLButtonElement;
const stopButton = $("#stop-command") as HTMLButtonElement;

// Define custom UI elements
const g = new Grid($("#grid-container")!, config);
g.render();

const s = new Stat($("#stat-container")!, {
    track: [
        {
            name: "FPS",
            extrema: "min",
        },
        {
            name: "Latency",
            extrema: "max",
            unit: "ms",
        },
    ],
    graphPeriod: 10000,
    graphpoints: 1000,
});

const conn = new Connect(handleConnect);
conn.show();

onTx((b) => {
    cHandle?.write(b);
    // console.log(
    //     `TX: ${Array.from(b)
    //         .map((x) => String.fromCharCode(x))
    //         .join("")}`,
    // );
});

const cam = new CamInteractor();

// Define connection handle
const cCb: msg_cb_t = {
    close: handleClose,
    smacc: {
        cb: handleData,
        bytes: handleByteCB,
        timeout: 500,
    },
};
let cHandle: handle_t | null = null;

// Track data updates for performance stats
let lastFrame = performance.now();

// Show connection panel on disconnect
devicePanel.addEventListener("click", () => {
    cHandle?.close();
    conn.show();
});

async function handleConnect(mode: "ser" | "sok") {
    conn.error("");

    let handleOrError: handle_t | string | null = null;

    switch (mode) {
        case "sok":
            handleOrError = await handleSocket("http://localhost:3000", cCb);
            portName.textContent = "localhost:3000";
            break;

        case "ser":
            handleOrError = await handleSerial(cCb);

            if (typeof handleOrError !== "string")
                portName.textContent = handleOrError.port;
    }

    if (handleOrError === null) return; // Ignore invalid value

    // Indicate error
    if (typeof handleOrError === "string") {
        conn.error(handleOrError);
        return;
    }

    // Close previous connection if it exists
    handleClose();
    cHandle = handleOrError;
    conn.hide();

    statusWord.textContent = "Connected";
    statusWord.classList.remove("offline");
    statusWord.classList.add("online");

    s.clear("FPS");
    s.clear("Latency");
}

function handleClose() {
    if (!cHandle) return;

    s.clear("FPS");
    s.clear("Latency");

    cHandle?.close();
    cHandle = null;
    conn.show();

    statusWord.textContent = "Disconnected";
    statusWord.classList.remove("online");
    statusWord.classList.add("offline");

    commandDisplay.innerHTML = "";
}

let frameDebounce: null | number = null;
let frameData: Uint8Array | null = null;

function handleData(data: Uint8Array) {
    const now = performance.now();

    if (data[0] === 0x00) {
        // Update grid
        if (frameDebounce === null) {
            g.update(Array.from(data.subarray(1)));
            g.render();

            frameDebounce = setTimeout(() => {
                frameDebounce = null;

                // More data to render!
                if (frameData !== null) {
                    handleData(frameData);
                    frameData = null;
                }
            }, 0);

            // Update stat
            s.update("FPS", 1000 / (now - lastFrame));
            lastFrame = now;
        } else {
            frameData = data;
        }
    } else {
        const { latency, error, code } = onRx(data);

        if (error) {
            toast.error(`Renderer failed with code ${code}`, 0);
        }

        if (latency !== null) s.update("Latency", latency);
    }
}

function handleByteCB(buf: Uint8Array): number {
    if (buf[0] === 0x00) return bytes + 1; // Data packet
    return 2; // Response packet; [err+id, response]
}

// Setup manual camera controls
document.querySelectorAll(".camera-controls button").forEach((btn) => {
    let interval: number | null = null;

    const action = btn.getAttribute("data-cam");

    const start = (e: Event) => {
        interval = window.setInterval(() => {
            updateCam(e);
        }, 50);
    };

    const stop = () => {
        if (interval !== null) {
            clearInterval(interval);
            interval = null;
        }
    };

    btn.addEventListener("click", updateCam);
    btn.addEventListener("mousedown", start);
    btn.addEventListener("mouseup", stop);
    btn.addEventListener("mouseleave", stop);
});

function updateCam(e: Event) {
    if (!(e.target instanceof HTMLElement)) return; // Invalid click

    const btn = e.target.closest("button");
    if (!btn) return;

    const vec = cam.getPos();
    const quat = cam.getPivot();
    let { width, height } = cam.getSize();

    // Transform vec into cameraspace
    vec.rotate(quat.clone().conjugate());

    let vecUpdated = false;
    let quatUpdated = false;
    let scaleUpdated = false;

    const pivotStep = 5 * (Math.PI / 180);

    switch (btn.dataset.cam) {
        case "reset":
            vec.copy(new Vec3(0, 0, 0));
            quat.copy(new Quat(0, 0, 0, 1));
            width = 128;
            height = 64;
            vecUpdated = true;
            quatUpdated = true;
            scaleUpdated = true;
            break;

        case "forward":
            vec.z += 1;
            vecUpdated = true;
            break;
        case "backward":
            vec.z -= 1;
            vecUpdated = true;
            break;

        case "left":
            vec.x -= 1;
            vecUpdated = true;
            break;
        case "right":
            vec.x += 1;
            vecUpdated = true;
            break;

        case "up":
            vec.y += 1;
            vecUpdated = true;
            break;
        case "down":
            vec.y -= 1;
            vecUpdated = true;
            break;

        case "yaw-left": {
            const rotator = new Quat(
                0,
                -Math.sin(pivotStep / 2),
                0,
                Math.cos(pivotStep / 2),
            );

            rotator.rotateBy(quat);
            quat.copy(rotator);
            quatUpdated = true;
            break;
        }
        case "yaw-right": {
            const rotator = new Quat(
                0,
                Math.sin(pivotStep / 2),
                0,
                Math.cos(pivotStep / 2),
            );

            rotator.rotateBy(quat);
            quat.copy(rotator);
            quatUpdated = true;
            break;
        }

        case "pitch-up": {
            const rotator = new Quat(
                -Math.sin(pivotStep / 2),
                0,
                0,
                Math.cos(pivotStep / 2),
            );
            quat.rotateBy(rotator);
            quatUpdated = true;
            break;
        }
        case "pitch-down": {
            const rotator = new Quat(
                Math.sin(pivotStep / 2),
                0,
                0,
                Math.cos(pivotStep / 2),
            );
            quat.rotateBy(rotator);
            quatUpdated = true;
            break;
        }

        case "zoom-in":
            width /= 1.1;
            height /= 1.1;
            scaleUpdated = true;
            break;
        case "zoom-out":
            width *= 1.1;
            height *= 1.1;
            scaleUpdated = true;
            break;
    }

    // Transform vec back into worldspace
    vec.rotate(quat);

    if (vecUpdated) cam.pos(vec);
    if (quatUpdated) cam.pivot(quat);
    if (scaleUpdated) {
        // Constrain width/height to 254
        if (width > 254) {
            height = height * (254 / width);
            width = 254;
        }
        if (height > 254) {
            width = width * (254 / height);
            height = 254;
        }

        cam.resize(width, height);
    }
}

// Render camera
cam.onChange(() => {
    // Establish basis X/Y/Z vectors
    const x = new Vec3(1, 0, 0);
    const y = new Vec3(0, 1, 0);
    const z = new Vec3(0, 0, 1);

    // Rotate all basis vectors by the camera's quat
    const quat = cam.getPivot().conjugate();

    x.rotate(quat);
    y.rotate(quat);
    z.rotate(quat);

    const w = gizmo_canvas.width;
    const h = gizmo_canvas.height;
    const camera_z = 5; // Add perspective to gizmo

    const toCameraSpace = (vec: Vec3): [x: number, y: number] => {
        const scale = camera_z / (camera_z - vec.z);

        return [
            w / 2 + vec.x * scale * (w / 2),
            h / 2 + -vec.y * scale * (h / 2),
        ];
    };

    const vectors: {
        colorA: string;
        colorB: string;
        vector: Vec3;
    }[] = [
        {
            colorA: "#FF0000",
            colorB: "#880000",
            vector: x,
        },
        {
            colorA: "#00FF00",
            colorB: "#008800",
            vector: y,
        },

        {
            colorA: "#0000FF",
            colorB: "#000088",
            vector: z,
        },
    ];

    // Sort vector list by Z for proper ordering
    vectors.sort((a, b) => a.vector.z - b.vector.z);

    // Render gizmo by projecting onto the XY plane
    gizmo_ctx.beginPath();
    gizmo_ctx.clearRect(0, 0, w, h);

    for (const { colorA, colorB, vector } of vectors) {
        gizmo_ctx.beginPath();
        gizmo_ctx.moveTo(w / 2, h / 2);
        gizmo_ctx.lineTo(...toCameraSpace(vector));
        gizmo_ctx.strokeStyle = vector.z >= 0 ? colorA : colorB;
        gizmo_ctx.lineWidth = 6;
        gizmo_ctx.stroke();
    }

    const vec = cam.getPos();
    $("#cam-x")!.textContent = Math.round(vec.x).toString();
    $("#cam-y")!.textContent = Math.round(vec.y).toString();
    $("#cam-z")!.textContent = Math.round(vec.z).toString();
});

// Code editing

const preset = new URL(location.href).searchParams.get("preset") || null;

// Save in-progress commands before reloading
window.addEventListener("beforeunload", () => {
    if (preset === null)
        localStorage.setItem("command-input", commandInput.value);
});

// Load in-progress commands after loading
if (preset === null)
    commandInput.value = localStorage.getItem("command-input") ?? "";
// Fetch preset list
else {
    fetch(new URL("/presets.json", import.meta.url))
        .then((v) => v.json())
        .then((presets) => {
            if (!Object.hasOwn(presets, preset)) {
                toast.warn(`Unable to find preset "${preset}"`);
                toast.info(
                    `Available presets: [ ${Object.keys(presets).join(", ")} ]`,
                    0,
                );
            }

            // Load preset
            commandInput.value = presets[preset];
            toast.info(`Successfully loadedp preset "${preset}"`, 5000);
        })
        .catch((err) => {
            toast.error("Failed to fetch presets...", 0);
        });
}

// Run commands
commandButton.addEventListener("click", runCode);
stopButton.addEventListener("click", stopCode);

let codeRunner: Worker | null = null;
function runCode() {
    // Kill the current runner
    if (codeRunner) {
        codeRunner.terminate();
        codeRunner = null;
    }

    // Create new running environment
    codeRunner = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
    });

    const code = commandInput.value;

    // Trim empty start/end lines
    const lines = code
        .replace(/^(\s*\n)+|(\s*\n)+$/g, "")
        .replace(/(\s*)/, "")
        .split("\n");

    // Push active code to element
    commandDisplay.innerHTML = "";
    for (const line of lines) {
        const lineEl = document.createElement("div");
        lineEl.classList.add("cmd-line");
        lineEl.textContent = line;

        commandDisplay.append(lineEl);
    }

    // Run code
    codeRunner.postMessage({
        type: "code",
        code,
    });

    codeRunner.onmessage = onCodeMessage;
    codeRunner.onerror = (ev: ErrorEvent) => {
        if (!codeRunner) return;

        codeRunner?.terminate();
        codeRunner = null;
        commandDisplay.innerHTML = "";

        toast.error(ev.error);
    };
}

function stopCode() {
    if (!codeRunner) return; // No code to stop

    commandDisplay.innerHTML = "";

    codeRunner.terminate();
    codeRunner = null;
}

/**
 * Called on message receipt from code runner
 */
function onCodeMessage(ev: MessageEvent) {
    if (!codeRunner) return; // Cannot receive message from non-existant runner; Ignore!

    switch (ev.data.type) {
        case "error":
            codeRunner.terminate();
            codeRunner = null;
            commandDisplay.innerHTML = "";

            toast.error(ev.data.error);
            break;
        case "done":
            codeRunner.terminate();
            codeRunner = null;
            commandDisplay.innerHTML = "";
            break;

        // Forward message to bridge handler
        case "msg":
            onBridgeRx(ev.data.msg);
            break;
    }
}

// Forward message back over bridge
onBridgeTx((msg) => {
    if (!codeRunner) return; // No code runner to respond to messages; Ignore!
    codeRunner.postMessage({
        type: "msg",
        msg: msg,
    });
});

// Register factories for bridge
registerPuppetClass("obj", createObjInteractor);
registerPuppetClass("seg", createSegInteractor);
registerPuppetClass("cam", () => cam); // Treat camera object as a singleton (only one camera in scene)
