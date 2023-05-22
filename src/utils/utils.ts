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
