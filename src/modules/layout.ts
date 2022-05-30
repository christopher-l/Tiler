export type TilingType = 'split-h' | 'split-v' | 'stacking';
import { Meta } from 'imports/gi';
import { Window } from 'modules/window';

export interface LayoutConfig {
    defaultLayout: TilingType;
    gapSize: number;
    rootRect: Meta.Rectangle;
}

export type Layout = TilingLayout;

export class RootLayout {
    floating: Window[] = [];
    tiling: TilingLayout = createTilingLayout(this, null, this.config.defaultLayout);

    constructor(public config: LayoutConfig) {
        this.tiling.updatePositionAndSize(subtractGaps(this.config.rootRect, this.config.gapSize));
    }

    tileWindow(window: Window): void {
        if (window.get_maximized()) {
            window.unmaximize(Meta.MaximizeFlags.BOTH);
        }
        if (!window.allows_resize()) {
            return;
        }
        let layout = this.tiling;
        while (layout.children.length > 0 && layout.children[0].node.kind === 'layout') {
            layout = layout.children[0].node.layout;
        }
        if (layout.children.length === 0 || layout.type === this.config.defaultLayout) {
            // Add the window to the existing layout.
            layout.insertWindow(window);
            layout.updatePositionAndSize(layout.rect!);
        } else if (layout.children[0]?.node.kind === 'window') {
            // Replace the first window of the existing layout with the default layout, holding the
            // existing window and the new one.
            const nodeWindow = layout.children[0].node.window;
            const newLayout = createTilingLayout(this, layout, this.config.defaultLayout);
            newLayout.insertWindow(nodeWindow);
            newLayout.insertWindow(window);
            layout.children[0].node = {
                kind: 'layout',
                layout: newLayout,
            };
            newLayout.updatePositionAndSize(nodeWindow.get_frame_rect());
        } else {
            throw new Error('unreachable');
        }
    }
}

function createTilingLayout(
    root: RootLayout,
    parent: TilingLayout | null,
    type: TilingType,
): TilingLayout {
    switch (type) {
        case 'split-h':
        case 'split-v':
            return new SplitLayout(root, parent, type);
        case 'stacking':
            return new StackingLayout(root, parent);
    }
}

export type TilingLayout = SplitLayout | StackingLayout;

class BaseLayout {
    rect?: Meta.Rectangle;

    constructor(public root: RootLayout, public parent: TilingLayout | null) {}
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

    constructor(
        root: RootLayout,
        parent: BaseLayout['parent'],
        public type: 'split-h' | 'split-v',
    ) {
        super(root, parent);
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
        window.tilingState = { rootLayout: this.root, state: 'tiling', parent: this };
    }

    updatePositionAndSize(rect: Meta.Rectangle): void {
        this.rect = rect;
        let offset = 0;
        let sizeAcc = 0;
        const totalTiledSize = this.type === 'split-h' ? rect.width : rect.height;
        this.children.forEach((child, index) => {
            sizeAcc += child.size;
            const tileStart = offset;
            const tileEnd =
                (totalTiledSize - (this.children.length - 1 - index) * this.root.config.gapSize) *
                sizeAcc;
            const x = this.type === 'split-h' ? tileStart + rect.x : rect.x;
            const y = this.type === 'split-v' ? tileStart + rect.y : rect.y;
            const width = this.type === 'split-h' ? tileEnd - tileStart : rect.width;
            const height = this.type === 'split-v' ? tileEnd - tileStart : rect.height;
            if (child.node.kind === 'window') {
                child.node.window.move_resize_frame(false, x, y, width, height);
            } else {
                child.node.layout.updatePositionAndSize(createRectangle(x, y, width, height));
            }
            offset = tileEnd + this.root.config.gapSize;
        });
    }
}

class StackingLayout extends BaseLayout {
    type: 'stacking' = 'stacking';
    children: {
        node: { kind: 'window'; window: Window };
    }[] = [];

    constructor(root: RootLayout, parent: BaseLayout['parent']) {
        super(root, parent);
    }

    insertWindow(window: Window): void {
        this.children.push({ node: { kind: 'window', window } });
        window.tilingState = { rootLayout: this.root, state: 'tiling', parent: this };
    }

    updatePositionAndSize(rect: Meta.Rectangle): void {
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

function subtractGaps(rect: Meta.Rectangle, gapSize: number): Meta.Rectangle {
    const result = new Meta.Rectangle();
    result.x = rect.x + gapSize;
    result.y = rect.y + gapSize;
    result.width = rect.width - gapSize * 2;
    result.height = rect.height - gapSize * 2;
    return result;
}
