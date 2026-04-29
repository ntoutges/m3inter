import { Connect } from "./connect/connect.js";
import {
    handle_t,
    handleSerial,
    handleSocket,
    msg_cb_t,
} from "./connect/handler.js";
import { Grid } from "./grid/grid.js";
import { config } from "./setup.json";

const $ = document.querySelector.bind(document);

// Define elements as globals for ease-of-use
const devicePanel = $("#device-panel") as HTMLElement;

// Define custom UI elements
const g = new Grid($("#grid-container")!, config);
g.render();

const conn = new Connect(handleConnect);
conn.show();

// Define connection handle
const cCb: msg_cb_t = {
    close: handleClose,
    acc: {
        cb: handleData,
        bytes: 1024,
        timeout: 0,
    },
};
let cHandle: handle_t | null = null;

// Show connection panel on disconnect
devicePanel.addEventListener("click", () => {
    cHandle?.close();
    conn.show();
});

async function handleConnect(mode: "ser" | "sok") {
    let handleOrError: handle_t | string | null = null;

    switch (mode) {
        case "sok":
            handleOrError = await handleSocket("http://localhost:3000", cCb);
            break;

        case "ser":
            handleOrError = await handleSerial(cCb);
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
}

function handleClose() {
    if (!cHandle) return;

    cHandle?.close();
    cHandle = null;
    conn.show();
}

function handleData(data: Uint8Array) {
    g.update(Array.from(data));
    g.render();
}
