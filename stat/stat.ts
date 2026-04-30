import "./stat.css";
import html from "./stat.html?raw";

const _template = document.createElement("template");
_template.innerHTML = html;
const template = _template.content;

type stat_track = {
    name: string;
    unit?: string;
    extrema: "min" | "max";
};

type stat_init = {
    track: stat_track[];
    graphpoints: number;
    graphPeriod: number;
};

type stat_internal = {
    values: { time: number; value: number }[];
    unit?: string;
    extrema: "min" | "max";

    // DOM references for fast updates
    el: HTMLElement;
    avgEl: HTMLElement;
    low5El: HTMLElement;
    low1El: HTMLElement;
};

export class Stat {
    private readonly element: HTMLElement;
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;

    private readonly stats = new Map<string, stat_internal>();
    private readonly order: string[] = [];

    private readonly graphPeriod: number;
    private readonly graphpoints: number;

    private animationFrame: number | null = null;

    constructor(parent: HTMLElement, config: stat_init) {
        this.element = template
            .querySelector(".stat")!
            .cloneNode(true) as HTMLElement;

        this.canvas = this.element.querySelector("canvas")!;
        this.ctx = this.canvas.getContext("2d")!;

        parent.appendChild(this.element);

        this.graphPeriod = config.graphPeriod;
        this.graphpoints = config.graphpoints;

        this.initializeUI(config.track);
        this.resize();

        new ResizeObserver(() => this.resize()).observe(
            this.element.querySelector(".stat-breakdown")!,
        );

        this.loop();
    }

    /**
     * Initialize UI entries for each stat
     */
    private initializeUI(track: stat_track[]) {
        const breakdown = this.element.querySelector(".stat-breakdown")!;

        for (const stat of track) {
            const entry = template
                .querySelector(".stat-entry")!
                .cloneNode(true) as HTMLElement;

            entry.querySelector(".stat-label")!.textContent = stat.name;

            if (stat.unit) {
                entry.querySelector(".stat-unit")!.textContent =
                    ` ${stat.unit}`;
            }

            entry
                .querySelectorAll(".stat-extrema")!
                .forEach(
                    (el) =>
                        (el.textContent = stat.extrema === "min" ? "L" : "H"),
                );

            const avgEl = entry.querySelector<HTMLElement>(".stat-avg")!;
            const low5El = entry.querySelector<HTMLElement>(".stat-low-5")!;
            const low1El = entry.querySelector<HTMLElement>(".stat-low-1")!;

            breakdown.appendChild(entry);

            this.stats.set(stat.name, {
                values: [],
                unit: stat.unit,
                extrema: stat.extrema,
                el: entry,
                avgEl,
                low5El,
                low1El,
            });

            this.order.push(stat.name);
        }
    }

    /**
     * Resize canvas to match display size
     */
    private resize() {
        const rect = this.element
            .querySelector(".stat-breakdown")!
            .getBoundingClientRect();

        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.canvas.style.height = `${rect.height}px`;
    }

    /**
     * Main render loop
     */
    private loop = () => {
        this.render();
        this.animationFrame = requestAnimationFrame(this.loop);
    };

    /**
     * Compute avg + percentiles
     */
    private compute(values: number[], extrema: "min" | "max") {
        if (values.length === 0) {
            return { avg: 0, p5: 0, p1: 0 };
        }

        const sorted = [...values].sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);

        const avg = sum / values.length;

        const pick = (p: number) => {
            const idx = Math.floor(p * (sorted.length - 1));
            return sorted[idx];
        };

        const p5 = extrema === "min" ? pick(0.05) : pick(0.95);
        const p1 = extrema === "min" ? pick(0.01) : pick(0.99);

        return { avg, p5, p1 };
    }

    /**
     * Render graph + update UI
     */
    private render() {
        const now = performance.now();

        const w = this.canvas.width;
        const h = this.canvas.height;

        this.ctx.clearRect(0, 0, w, h);

        let colorIndex = 0;

        const cutoff = now - this.graphPeriod;
        for (const name of this.order) {
            const stat = this.stats.get(name)!;

            // Trim old values
            // These are all values that don't impact the current graph anymore
            // Points s.t. the next point is non-existant or already outside the graph area

            for (let i = 0; i < stat.values.length; i++) {
                const curr = stat.values[i];
                const next = stat.values[i + 1];

                // Assuming sorted; All points after the first safe point are also safe
                if (curr.time > cutoff || (next && next.time > cutoff)) break;

                stat.values.splice(i, 1);
                i--;
            }

            const values = stat.values.map((v) => v.value);

            const { avg, p5, p1 } = this.compute(values, stat.extrema);

            // Update UI
            stat.avgEl.textContent = avg.toFixed(1);

            stat.low5El.textContent = p5.toFixed(1);
            stat.low1El.textContent = p1.toFixed(1);

            // Draw graph
            if (stat.values.length > 1) {
                const max = Math.max(...values);
                const min = Math.min(...values);

                this.ctx.beginPath();

                stat.values.forEach((v, i) => {
                    const x = w - ((now - v.time) / this.graphPeriod) * w;
                    const y = h - ((v.value - min) / (max - min || 1)) * h;

                    if (i === 0) this.ctx.moveTo(x, y);
                    else this.ctx.lineTo(x, y);
                });

                // Extend final point to the end of the graph for better visibility
                const last = stat.values[stat.values.length - 1];
                const y = h - ((last.value - min) / (max - min || 1)) * h;

                this.ctx.lineTo(w, y);

                this.ctx.strokeStyle = `hsl(${colorIndex * 53}, 70%, 60%)`;
                this.ctx.lineWidth = 1;
                this.ctx.stroke();
            }

            colorIndex++;
        }
    }

    /**
     * Push new value into stat
     * @param name Stat name
     * @param value Stat value
     */
    update(name: string, value: number) {
        const stat = this.stats.get(name);
        if (!stat) return;

        const now = performance.now();

        stat.values.push({ time: now, value });

        if (stat.values.length > this.graphpoints) {
            stat.values.shift();
        }
    }

    /**
     * Clear the data series for some stat
     * @param name The name of the stat whose data will be cleared
     */
    clear(name: string) {
        const stat = this.stats.get(name);
        if (!stat) return;

        stat.values = [];
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.animationFrame !== null) {
            cancelAnimationFrame(this.animationFrame);
        }

        this.element.remove();
    }
}
