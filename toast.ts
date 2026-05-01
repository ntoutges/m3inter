type ToastType = "info" | "warn" | "error";

const toastContainer = document.getElementById("toast-container")!;
const toastTemplate = document.getElementById(
    "toast-template",
) as HTMLTemplateElement;

const MAX_TOASTS = 5;

/**
 * Create and show a toast
 */
export function showToast(
    message: string,
    type: ToastType = "info",
    duration = 3000,
) {
    const node = toastTemplate.content.firstElementChild!.cloneNode(
        true,
    ) as HTMLElement;

    node.classList.add(type);

    const msgEl = node.querySelector(".toast-message")!;
    msgEl.textContent = message;

    toastContainer.appendChild(node);

    // Auto-remove
    let timeout: null | ReturnType<typeof setTimeout> = null;
    if (duration > 0) {
        timeout = setTimeout(() => {
            hideToast(node);
        }, duration);
    }

    // Click to dismiss early
    node.addEventListener("click", () => {
        if (timeout !== null) clearTimeout(timeout);
        hideToast(node);
    });

    // Pause clear on hover
    node.addEventListener("mouseenter", () => {
        if (timeout !== null) {
            clearTimeout(timeout);
            timeout = null;
        }
    });
    node.addEventListener("mouseleave", () => {
        timeout = setTimeout(() => hideToast(node), 1500);
    });

    enforceLimit();
}

/**
 * Hide + remove toast with animation
 */
function hideToast(el: HTMLElement) {
    el.classList.add("hide");

    setTimeout(() => {
        el.remove();
    }, 200); // match CSS transition
}

function enforceLimit() {
    while (toastContainer.children.length > MAX_TOASTS) {
        toastContainer.firstElementChild?.remove();
    }
}

export const toast = {
    info: (msg: string, duration?: number) => showToast(msg, "info", duration),
    warn: (msg: string, duration?: number) => showToast(msg, "warn", duration),
    error: (msg: string, duration?: number) =>
        showToast(msg, "error", duration),
};
