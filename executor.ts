/**
 * Execute interactor code
 */

import { CamInteractor } from "./plang/cam.js";
import { ObjInteractor } from "./plang/obj.js";
import { SegInteractor } from "./plang/seg.js";
import { Vec3, Quat } from "./plang/prim.js";

export const cam = new CamInteractor();
