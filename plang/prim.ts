/**
 * Primitive data types and functions for the plang interactor
 */

/**
 * A 3D vector capable of storing values from -128 to 127, used for positions and pivots
 */
export class Vec3 {
    private _x!: number;
    private _y!: number;
    private _z!: number;

    constructor(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    set x(value: number) {
        this._x = Math.max(-128, Math.min(127, value));
    }

    set y(value: number) {
        this._y = Math.max(-128, Math.min(127, value));
    }

    set z(value: number) {
        this._z = Math.max(-128, Math.min(127, value));
    }

    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
    get z() {
        return this._z;
    }

    clone() {
        return new Vec3(this.x, this.y, this.z);
    }

    copy(other: Vec3) {
        this.x = other.x;
        this.y = other.y;
        this.z = other.z;
    }

    /** Adds another vector (in-place) */
    add(v: Vec3) {
        this.x += v.x;
        this.y += v.y;
        this.z += v.z;
        return this;
    }

    /** Subtracts another vector (in-place) */
    sub(v: Vec3) {
        this.x -= v.x;
        this.y -= v.y;
        this.z -= v.z;
        return this;
    }

    /** Dot product */
    dot(v: Vec3): number {
        return this.x * v.x + this.y * v.y + this.z * v.z;
    }

    /** Cross product */
    cross(v: Vec3): Vec3 {
        return new Vec3(
            this.y * v.z - this.z * v.y,
            this.z * v.x - this.x * v.z,
            this.x * v.y - this.y * v.x,
        );
    }

    /** Normalize vector to unit length */
    normalize() {
        const mag = Math.sqrt(
            this.x * this.x + this.y * this.y + this.z * this.z,
        );

        if (mag === 0) {
            this.x = 0;
            this.y = 0;
            this.z = 1;
        } else {
            this.x /= mag;
            this.y /= mag;
            this.z /= mag;
        }

        return this;
    }

    /** Rotate this vector by a quaternion */
    rotate(q: Quat) {
        const x = this.x,
            y = this.y,
            z = this.z;
        const qx = q.x,
            qy = q.y,
            qz = q.z,
            qw = q.w;

        // Equivalent to q * v * q^-1 but expanded (same as your C)
        this.x =
            (1 - 2 * qy * qy - 2 * qz * qz) * x +
            2 * (qx * qy - qz * qw) * y +
            2 * (qx * qz + qy * qw) * z;
        this.y =
            2 * (qx * qy + qz * qw) * x +
            (1 - 2 * qx * qx - 2 * qz * qz) * y +
            2 * (qy * qz - qx * qw) * z;
        this.z =
            2 * (qx * qz - qy * qw) * x +
            2 * (qy * qz + qx * qw) * y +
            (1 - 2 * qx * qx - 2 * qy * qy) * z;

        return this;
    }
}

/**
 * A 4D quaternion capable of storing rotation
 * The magnitude of all components is always 1
 */
export class Quat {
    private _x!: number;
    private _y!: number;
    private _z!: number;
    private _w!: number;

    constructor(x: number, y: number, z: number, w: number) {
        const mag = Math.sqrt(x * x + y * y + z * z + w * w);

        if (mag === 0) {
            this._x = 0;
            this._y = 0;
            this._z = 0;
            this._w = 1;
        } else {
            this._x = x / mag;
            this._y = y / mag;
            this._z = z / mag;
            this._w = w / mag;
        }
    }

    get x() {
        return this._x;
    }
    get y() {
        return this._y;
    }
    get z() {
        return this._z;
    }
    get w() {
        return this._w;
    }

    clone() {
        return new Quat(this.x, this.y, this.z, this.w);
    }

    copy(other: Quat) {
        this._x = other.x;
        this._y = other.y;
        this._z = other.z;
        this._w = other.w;
    }

    /** Normalize quaternion */
    normalize() {
        const mag = Math.sqrt(
            this.x * this.x +
                this.y * this.y +
                this.z * this.z +
                this.w * this.w,
        );

        if (mag === 0) {
            this._x = 0;
            this._y = 0;
            this._z = 0;
            this._w = 1;
        } else {
            this._x /= mag;
            this._y /= mag;
            this._z /= mag;
            this._w /= mag;
        }

        return this;
    }

    /** Multiply (compose rotations): this = this * q */
    multiply(q: Quat) {
        const x = this.x,
            y = this.y,
            z = this.z,
            w = this.w;

        this._x = w * q.x + x * q.w + y * q.z - z * q.y;
        this._y = w * q.y - x * q.z + y * q.w + z * q.x;
        this._z = w * q.z + x * q.y - y * q.x + z * q.w;
        this._w = w * q.w - x * q.x - y * q.y - z * q.z;

        return this.normalize();
    }

    /** Conjugate (inverse for unit quats) */
    conjugate(): Quat {
        return new Quat(-this.x, -this.y, -this.z, this.w);
    }

    /** Rotate this quaternion by another (like m3_quat_rotate_by) */
    rotateBy(q: Quat) {
        return this.multiply(q);
    }

    /** Create quaternion from direction + up (port of m3_vec_to_quat) */
    static fromDirection(dir: Vec3, up: Vec3): Quat {
        const f = dir.clone().normalize();
        const r = up.clone().cross(f).normalize();
        const u = f.clone().cross(r).normalize();

        const m00 = r.x,
            m01 = u.x,
            m02 = f.x;
        const m10 = r.y,
            m11 = u.y,
            m12 = f.y;
        const m20 = r.z,
            m21 = u.z,
            m22 = f.z;

        const trace = m00 + m11 + m22;

        let x, y, z, w;

        if (trace > 0) {
            const s = Math.sqrt(trace + 1) * 2;
            w = 0.25 * s;
            x = (m21 - m12) / s;
            y = (m02 - m20) / s;
            z = (m10 - m01) / s;
        } else if (m00 > m11 && m00 > m22) {
            const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
            w = (m21 - m12) / s;
            x = 0.25 * s;
            y = (m01 + m10) / s;
            z = (m02 + m20) / s;
        } else if (m11 > m22) {
            const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
            w = (m02 - m20) / s;
            x = (m01 + m10) / s;
            y = 0.25 * s;
            z = (m12 + m21) / s;
        } else {
            const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
            w = (m10 - m01) / s;
            x = (m02 + m20) / s;
            y = (m12 + m21) / s;
            z = 0.25 * s;
        }

        return new Quat(x, y, z, w);
    }
}
