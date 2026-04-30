/**
 * Segment interactor for micro3d
 * Represents a segment belonging to an object
 */

import {
    Interactor,
    PuppetInteractor,
    registerPuppetClass,
} from "./interactor.js";
import { Vec3 } from "./prim.js";
import { ObjInteractor, PObjInteractor } from "./obj.js";

/**
 * Allowed segment colors
 */
export enum SegColor {
    INVISIBLE = 0,
    DARK = 1,
    DIM = 2,
    FULL = 3,
}

/**
 * Segment controller
 */
export class SegInteractor extends Interactor {
    private readonly obj: ObjInteractor;
    private _vid: number | null = null;

    constructor(obj: ObjInteractor) {
        super("seg");
        this.obj = obj;

        this.timeout(0);

        obj.id()
            .then((id) => {
                this.cmd("create", id)
                    .then(this._load.bind(this))
                    .catch(this._load.bind(this, null));
            })
            .catch(() => {
                this._load(null);
            });
    }

    /**
     * Get the id of this object
     */
    id(): Promise<number> {
        return this.queue(this._id);
    }

    /**
     * Set segment offset
     */
    offset(x: number, y: number, z: number): Promise<void>;
    offset(vec: Vec3): Promise<void>;
    async offset(xOrVec: number | Vec3, y?: number, z?: number) {
        if (xOrVec instanceof Vec3) {
            z = xOrVec.z;
            y = xOrVec.y;
            xOrVec = xOrVec.x;
        }

        return this.queue(this._offset, xOrVec, y!, z!);
    }

    /**
     * Set whether segment is absolute or relative
     */
    async absolute(isAbsolute: boolean): Promise<void> {
        this.queue(this._absolute, isAbsolute);
    }

    /**
     * Set segment color
     */
    async color(color: SegColor): Promise<void> {
        this.queue(this._color, color);
    }

    private _id(): number {
        return this._vid!;
    }

    private async _offset(x: number, y: number, z: number) {
        const objId = await this.obj.id();

        await this.cmd(
            "offset",
            objId,
            this._id(),
            Math.round(x),
            Math.round(y),
            Math.round(z),
        );

        console.log("DONE!");
    }

    private async _absolute(isAbsolute: boolean) {
        const objId = await this.obj.id();

        await this.cmd("absolute", objId, this._id(), isAbsolute ? 1 : 0);
    }

    private async _color(color: SegColor) {
        const objId = await this.obj.id();

        await this.cmd("color", objId, this._id(), color);
    }

    /**
     * Called when the of this object resolves
     * @param id
     */
    private _load(id: number | null) {
        this._vid = id;
        this.dequeue(id !== null);
    }
}

export class PSegInteractor extends PuppetInteractor {
    constructor(obj: PObjInteractor) {
        super("seg", obj);
    }

    /**
     * Get the id of this object
     */
    id(): Promise<number> {
        return this.call("id");
    }

    /**
     * Set segment offset
     */
    offset(x: number, y: number, z: number): Promise<void>;
    offset(vec: Vec3): Promise<void>;
    async offset(xOrVec: number | Vec3, y?: number, z?: number) {
        if (xOrVec instanceof Vec3) {
            z = xOrVec.z;
            y = xOrVec.y;
            xOrVec = xOrVec.x;
        }

        return this.call("offset", xOrVec, y, z);
    }

    /**
     * Set whether segment is absolute or relative
     */
    absolute(isAbsolute: boolean): Promise<void> {
        return this.call("absolute", isAbsolute);
    }

    /**
     * Set segment color
     */
    color(color: SegColor): Promise<void> {
        return this.call("color", color);
    }
}

export function createSegInteractor(obj: ObjInteractor) {
    return new SegInteractor(obj);
}

export function createPSegInteractor(obj: PObjInteractor) {
    return new PSegInteractor(obj);
}
