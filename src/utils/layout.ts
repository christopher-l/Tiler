export type TilingType = 'split-h' | 'split-v' | 'stacking';
import { Meta } from 'imports/gi';

interface Window extends Meta.Window {
    layout?: Layout;
}

type Layout = TilingLayout;

export class RootLayout {
    floating: Window[] = [];
    tiling: TilingLayout = createTilingLayout(null, this.defaultLayout);

    constructor(public defaultLayout: TilingType) {}

    tileWindow(window: Window): void {
        let layout = this.tiling;
        while (layout.children.length > 0 && layout.children[0].node.kind === 'layout') {
            layout = layout.children[0].node.layout;
        }
        if (layout.children.length === 0 || layout.type === this.defaultLayout) {
            layout.insertWindow(window);
        } else if (layout.children[0]?.node.kind === 'window') {
            const nodeWindow = layout.children[0].node.window;
            const newLayout = createTilingLayout(layout, this.defaultLayout);
            newLayout.insertWindow(nodeWindow);
            newLayout.insertWindow(window);
            layout.children[0].node = {
                kind: 'layout',
                layout: newLayout,
            };
        } else {
            throw new Error('unreachable');
        }
    }
}

function createTilingLayout(parent: TilingLayout | null, type: TilingType): TilingLayout {
    switch (type) {
        case 'split-h':
        case 'split-v':
            return new SplitLayout(parent, type);
        case 'stacking':
            return new StackingLayout(parent);
    }
}

export type TilingLayout = SplitLayout | StackingLayout;

class BaseLayout {
    rect?: Meta.Rectangle;

    constructor(public parent: TilingLayout | null) {}
}

class SplitLayout extends BaseLayout {
    children: {
        /**
         * Relative size of the node in the layout.
         *
         * The sum of sizes of all children in a layout is always 1.
         */
        size: number;
        node: { kind: 'layout'; layout: TilingLayout } | { kind: 'window'; window: Window };
    }[] = [];

    constructor(parent: BaseLayout['parent'], public type: 'split-h' | 'split-v') {
        super(parent);
    }

    insertWindow(window: Window): void {
        const nChildren = this.children.length;
        let newSize = 1 / (nChildren + 1);
        for (const child of this.children) {
            child.size *= 1 - newSize;
        }
        // Remove numeric errors
        newSize = this.children.reduce((newSize, child) => newSize - child.size, 1);
        this.children.push({ size: newSize, node: { kind: 'window', window } });
        window.layout = this;
    }

    updatePositionAndSize(rect: Meta.Rectangle, gapSize: number): void {
        this.rect = rect;
        let offset = 0;
        let sizeAcc = 0;
        const totalTiledSize = this.type === 'split-h' ? rect.width : rect.height;
        this.children.forEach((child, index) => {
            sizeAcc += child.size;
            const tileStart = offset;
            const tileEnd =
                (totalTiledSize - (this.children.length - 1 - index) * gapSize) * sizeAcc;
            const x = this.type === 'split-h' ? tileStart : rect.x;
            const y = this.type === 'split-v' ? tileStart : rect.y;
            const width = this.type === 'split-h' ? tileEnd - tileStart : rect.width;
            const height = this.type === 'split-v' ? tileEnd - tileStart : rect.height;
            if (child.node.kind === 'window') {
                child.node.window.move_resize_frame(false, x, y, width, height);
            } else {
                child.node.layout.updatePositionAndSize(
                    createRectangle(x, y, width, height),
                    gapSize,
                );
            }
            offset = tileEnd + gapSize;
        });
    }
}

class StackingLayout extends BaseLayout {
    type: 'stacking' = 'stacking';
    children: {
        node: { kind: 'window'; window: Window };
    }[] = [];

    constructor(parent: BaseLayout['parent']) {
        super(parent);
    }

    insertWindow(window: Window): void {
        this.children.push({ node: { kind: 'window', window } });
        window.layout = this;
    }

    updatePositionAndSize(rect: Meta.Rectangle, gapSize: number): void {
        this.rect = rect;
        for (const child of this.children) {
            child.node.window.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
        }
    }
}

function createRectangle(x: number, y: number, width: number, height: number): Meta.Rectangle {
    const rect = new Meta.Rectangle();
    rect.x = x;
    rect.y = y;
    rect.width = width;
    rect.height = height;
    return rect;
}
