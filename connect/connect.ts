import html from "./connect.html?raw";
import "./connect.css";

export class Connect {
    private overlay: HTMLElement;
    private modal: HTMLElement;
    private serialButton: HTMLButtonElement;
    private socketButton: HTMLButtonElement;

    constructor(onConnect: (mode: "ser" | "sok") => void) {
        // Create overlay
        this.overlay = document.createElement("div");
        this.overlay.classList.add("connect-overlay");

        // Create modal container
        this.modal = document.createElement("div");
        this.modal.classList.add("connect-modal");
        this.modal.innerHTML = html;

        this.overlay.appendChild(this.modal);
        document.body.appendChild(this.overlay);

        this.serialButton = this.modal.querySelector(".serial-btn")!;
        this.socketButton = this.modal.querySelector(".socket-btn")!;

        this.serialButton.addEventListener(
            "click",
            onConnect.bind(this, "ser"),
        );
        this.socketButton.addEventListener(
            "click",
            onConnect.bind(this, "sok"),
        );

        this.hide(); // Start hidden
    }

    public show(): void {
        this.overlay.style.display = "flex";
    }

    public hide(): void {
        this.overlay.style.display = "none";
    }

    public error(error: string): void {
        this.modal
            .querySelector<HTMLElement>(".modal-error")!
            .classList.remove("modal-info");
        this.modal.querySelector<HTMLElement>(".modal-error")!.textContent =
            error;
    }

    public info(info: string): void {
        this.modal
            .querySelector<HTMLElement>(".modal-error")!
            .classList.add("modal-info");
        this.modal.querySelector<HTMLElement>(".modal-error")!.textContent =
            info;
    }
}
