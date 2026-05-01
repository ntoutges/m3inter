/**
 * Define an object interactor
 */

import {
    Interactor,
    PuppetInteractor,
    registerPuppetClass,
} from "./interactor.js";
import { Quat, Vec3 } from "./prim.js";
import { PSegInteractor, SegInteractor } from "./seg.js";

/**
 * Define an interactor for micro3d objects
 * These are collections of segments that can be manipulated as a group
 */
export class ObjInteractor extends Interactor {
    private _vid: number | null = null;

    constructor() {
        super("obj");
        this.timeout(0);

        this.cmd("create")
            .then(this._load.bind(this))
            .catch(this._load.bind(this, null));
    }

    /**
     * Get the id of this object
     */
    id(): Promise<number> {
        return this.queue(this._id);
    }

    parent(other: ObjInteractor | number) {
        return this.queue(this._parent, other);
    }

    pos(x: number, y: number, z: number): Promise<void>;
    pos(vec: Vec3): Promise<void>;
    pos(xOrVec: number | Vec3, y?: number, z?: number): Promise<void> {
        if (xOrVec instanceof Vec3) {
            z = xOrVec.z;
            y = xOrVec.y;
            xOrVec = xOrVec.x;
        }

        return this.queue(this._pos, xOrVec, y!, z!);
    }

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

        return this.queue(this._pivot, xOrQuat, y!, z!, w!);
    }

    visible(visible: boolean) {
        return this.queue(this._visible, visible);
    }

    rlock(x: boolean, y: boolean) {
        return this.queue(this._rlock, x, y);
    }

    segment() {
        return new SegInteractor(this);
    }

    clear() {
        return this.queue(this._clear);
    }

    private _id(): number {
        return this._vid!;
    }

    private async _parent(other: ObjInteractor | number): Promise<void> {
        const otherId = typeof other === "number" ? other : await other.id();
        await this.cmd("parent", this._id(), otherId);
    }

    private async _pos(x: number, y: number, z: number): Promise<void> {
        await this.cmd(
            "pos",
            this._id(),
            Math.round(x),
            Math.round(y),
            Math.round(z),
        );
    }

    private async _pivot(
        x: number,
        y: number,
        z: number,
        w: number,
    ): Promise<void> {
        await this.cmd(
            "pivot",
            this._id(),

            Math.round(x * 127),
            Math.round(y * 127),
            Math.round(z * 127),
            Math.round(w * 127),
        );
    }

    private async _visible(visible: boolean): Promise<void> {
        await this.cmd("visible", this._id(), visible ? 1 : 0);
    }

    private async _rlock(x: boolean, y: boolean): Promise<void> {
        const rlock = (x ? "x" : "") + (y ? "y" : "");

        if (rlock) await this.cmd("rlock", this._id(), `-${rlock}`);
        else await this.cmd("rlock", this._id());
    }

    private async _clear(): Promise<void> {
        await this.cmd("clear", this._id());
    }

    /**
     * Called when the id of this object resolves
     * @param id
     */
    private _load(id: number | null) {
        this._vid = id;
        this.dequeue(id !== null);
    }
}

export class PObjInteractor extends PuppetInteractor {
    constructor() {
        super("obj");
    }

    /**
     * Get the id of this object
     */
    id(): Promise<number> {
        return this.call("id");
    }

    async parent(other: PObjInteractor | number) {
        const id = typeof other === "number" ? other : await other.id();
        return await this.call("parent", id);
    }

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

    visible(visible: boolean) {
        return this.call("visible", visible);
    }

    rlock(x: boolean, y: boolean) {
        return this.call("rlock", x, y);
    }

    segment() {
        return new PSegInteractor(this);
    }

    clear() {
        return this.call("clear");
    }
}

export function createObjInteractor() {
    return new ObjInteractor();
}

export function createPObjInteractor() {
    return new PObjInteractor();
}
