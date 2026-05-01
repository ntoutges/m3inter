/**
 * Camera interactor for micro3d
 * Controls the global camera state (position + rotation)
 */

import {
    Interactor,
    PuppetInteractor,
    registerPuppetClass,
} from "./interactor.js";
import { Vec3, Quat } from "./prim.js";

/**
 * Camera controller (no ID — singleton in renderer)
 */
export class CamInteractor extends Interactor {
    private readonly _pos: Vec3 = new Vec3(0, 0, 0);
    private readonly _quat: Quat = new Quat(0, 0, 0, 1);
    private readonly _listeners: (() => void)[] = [];

    private _width: number = 128;
    private _height: number = 64;

    constructor() {
        super("cam");

        this.timeout(0);
    }

    /**
     * Set camera position
     */
    pos(x: number, y: number, z: number): Promise<void>;
    pos(vec: Vec3): Promise<void>;
    async pos(xOrVec: number | Vec3, y?: number, z?: number): Promise<void> {
        if (xOrVec instanceof Vec3) {
            z = xOrVec.z;
            y = xOrVec.y;
            xOrVec = xOrVec.x;
        }

        this._pos.x = xOrVec;
        this._pos.y = y!;
        this._pos.z = z!;

        this._listeners.forEach((l) => l());

        await this.cmd(
            "pos",
            Math.round(xOrVec),
            Math.round(y!),
            Math.round(z!),
        );
    }

    /**
     * Set camera rotation (pivot quaternion)
     */
    pivot(x: number, y: number, z: number, w: number): Promise<void>;
    pivot(quat: Quat): Promise<void>;
    async pivot(
        xOrQuat: number | Quat,
        y?: number,
        z?: number,
        w?: number,
    ): Promise<void> {
        if (xOrQuat instanceof Quat) {
            w = xOrQuat.w;
            z = xOrQuat.z;
            y = xOrQuat.y;
            xOrQuat = xOrQuat.x;
        }

        this._quat.copy(new Quat(xOrQuat, y!, z!, w!));
        this._listeners.forEach((l) => l());

        await this.cmd(
            "pivot",
            Math.round(xOrQuat * 127),
            Math.round(y! * 127),
            Math.round(z! * 127),
            Math.round(w! * 127),
        );
    }

    async resize(width: number, height: number) {
        this._width = Math.min(Math.max(width, 1), 254);
        this._height = Math.min(Math.max(height, 1), 254);

        this._listeners.forEach((l) => l());

        await this.cmd(
            "resize",
            Math.round(this._width),
            Math.round(this._height),
        );
    }

    getPos() {
        return this._pos.clone();
    }

    getPivot() {
        return this._quat.clone();
    }

    getSize() {
        return { width: this._width, height: this._height };
    }

    onChange(cb: () => void) {
        this._listeners.push(cb);
        cb();
    }

    // UNOFFICIAL COMMAND
    clear() {
        return this.cmd("clear");
    }
}

export class PCamInteractor extends PuppetInteractor {
    constructor() {
        super("cam");
    }

    /**
     * Set camera position
     */
    pos(x: number, y: number, z: number): Promise<void>;
    pos(vec: Vec3): Promise<void>;
    pos(xOrVec: number | Vec3, y?: number, z?: number): Promise<void> {
        if (xOrVec instanceof Vec3) {
            z = xOrVec.z;
            y = xOrVec.y;
            xOrVec = xOrVec.x;
        }

        return this.call("pos", xOrVec, y, z);
    }

    /**
     * Set camera rotation (pivot quaternion)
     */
    pivot(x: number, y: number, z: number, w: number): Promise<void>;
    pivot(quat: Quat): Promise<void>;
    pivot(
        xOrQuat: number | Quat,
        y?: number,
        z?: number,
        w?: number,
    ): Promise<void> {
        if (xOrQuat instanceof Quat) {
            w = xOrQuat.w;
            z = xOrQuat.z;
            y = xOrQuat.y;
            xOrQuat = xOrQuat.x;
        }

        return this.call("pivot", xOrQuat, y, z, w);
    }

    resize(width: number, height: number) {
        return this.call("resize", width, height);
    }

    // UNOFFICIAL COMMAND
    clear() {
        return this.call("clear");
    }
}

/**
 * Factory helper
 */
export function createCamInteractor() {
    return new CamInteractor();
}

export function createPCamInteractor() {
    return new PCamInteractor();
}
