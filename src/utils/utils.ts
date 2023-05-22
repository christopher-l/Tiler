import { Meta } from 'imports/gi';
import { Direction } from 'modules/layout';
import { GLib } from 'imports/gi';
const Mainloop = imports.mainloop;

const DIRECTION_MASK = 61440;

type Orientation = 'horizontal' | 'vertical';

export function getHorizontalDirection(grabOp: Meta.GrabOp): 'left' | 'right' | null {
    if (grabOp & Meta.GrabOp.RESIZING_W & DIRECTION_MASK) {
        return 'left';
    } else if (grabOp & Meta.GrabOp.RESIZING_E & DIRECTION_MASK) {
        return 'right';
    } else {
        return null;
    }
}

export function getVerticalDirection(grabOp: Meta.GrabOp): 'up' | 'down' | null {
    if (grabOp & Meta.GrabOp.RESIZING_N & DIRECTION_MASK) {
        return 'up';
    } else if (grabOp & Meta.GrabOp.RESIZING_S & DIRECTION_MASK) {
        return 'down';
    } else {
        return null;
    }
}

export function getOrientation(direction: Direction): Orientation {
    if (direction === 'up' || direction === 'down') {
        return 'vertical';
    } else {
        return 'horizontal';
    }
}

export function timeout(action: () => void, delayMs = 0): void {
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMs, () => {
        action();
        return GLib.SOURCE_REMOVE;
    });
}

export function createRectangle(
    x: number,
    y: number,
    width: number,
    height: number,
): Meta.Rectangle {
    const rect = new Meta.Rectangle();
    rect.x = x;
    rect.y = y;
    rect.width = width;
    rect.height = height;
    return rect;
}

export function tick(timeout = 0): Promise<void> {
    return new Promise((resolve) => {
        Mainloop.timeout_add(timeout, resolve);
    });
}

type BaseObject = Record<string, unknown>;
type ValueOf<T> = T[keyof T];
type SomeObject<T extends BaseObject> = { [K in keyof T]: T[K] }[keyof T];
type MappedObject<T extends BaseObject> = { [K in keyof T]: T[K] }[keyof T];

// export function mapObject<T extends BaseObject, R extends BaseObject<K>>(
//     obj: T,
//     f: (key: K, value: T[K]) => R[K],
// ) {
//     return Object.entries(obj).reduce(
//         (acc, [key, value]) => ({ ...acc, [key as K]: f(key as K, value as T[K]) }),
//         {},
//     );
// }

export const mapObject =
    <T extends BaseObject, K extends keyof T>(obj: T) =>
    <Result>(cb: (key: K, value: T[K]) => Result) =>
        (Object.keys(obj) as Array<K>).reduce(
            (acc, key) => ({
                ...acc,
                [key]: cb(key, obj[key]),
            }),
            {} as Record<K, Result>,
        );

export function getHelpers<ItemType>() {
    return function <KeyType extends keyof ItemType>(key: KeyType) {
        return (item: ItemType) => item[key];
    };
}
