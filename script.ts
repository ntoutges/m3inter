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

const $ = document.querySelector.bind(document);

// Define elements as globals for ease-of-use
const devicePanel = $("#device-panel") as HTMLElement;
const portName = $("#com-port") as HTMLElement;
const statusWord = $("#connection-status") as HTMLElement;

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

// Define connection handle
const cCb: msg_cb_t = {
    close: handleClose,
    acc: {
        cb: handleData,
        bytes: 1024,
        timeout: 500,
    },
};
let cHandle: handle_t | null = null;

// Track data updates for performance stats
let lastFrame = performance.now();
let lastRequest = performance.now();

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
}

function handleData(data: Uint8Array) {
    const now = performance.now();

    // Update grid
    g.update(Array.from(data));
    g.render();

    // Update stats
    s.update("FPS", 1000 / (now - lastFrame));
    // s.update("Latency", now - lastRequest);

    lastFrame = now;
}
