import { Meta } from 'imports/gi';
import { TilingWindowState, Window } from 'modules/window';

export type WindowState = 'floating' | 'tiling';
export type TilingType = 'split-h' | 'split-v' | 'stacking';

export interface LayoutConfig {
    defaultLayout: TilingType;
    defaultWindowState: WindowState;
    gapSize: number;
    rootRect: Meta.Rectangle;
}

type LayoutNode = { kind: 'layout'; layout: TilingLayout };
type WindowNode = { kind: 'window'; window: Window };
type Node = LayoutNode | WindowNode;

export class RootLayout {
    // floating: Window[] = [];
    tiling: TilingLayout = createTilingLayout(this, null, this.config.defaultLayout);

    constructor(public config: LayoutConfig) {
        this.tiling.updatePositionAndSize(subtractGaps(this.config.rootRect, this.config.gapSize));
    }

    // TODO: call this
    destroy() {
        // TODO: iterate all windows and remove all connections
    }

    insertWindow(window: Window): void {
        window.tilingState = { ...(window.tilingState ?? {}), rootLayout: this };
        const targetState = this._getTargetState(window);
        switch (targetState) {
            case 'floating':
                this.floatWindow(window);
                break;
            case 'tiling':
                const couldTile = this.tileWindow(window);
                if (!couldTile) {
                    this.floatWindow(window);
                }
                break;
        }
        this._removeWhenClosed(window);
    }

    private _removeWhenClosed(window: Window): void {
        window.tilingState!.connections ??= [];
        const id = window.connect('unmanaged', () => {
            window.tilingState!.connections!.splice(
                window.tilingState!.connections!.indexOf(id),
                1,
            );
            this.removeWindow(window);
        });
        window.tilingState!.connections.push();
    }

    removeWindow(window: Window): void {
        const parent = window.tilingState!.parent;
        switch (window.tilingState!.state) {
            case 'floating':
                this._removeFloatingWindow(window);
                break;
            case 'tiling':
                this._removeTilingWindow(window);
                break;
        }
        window.tilingState!.rootLayout = null;
        if (parent) {
            parent.updatePositionAndSize();
        }
    }

    private _removeFloatingWindow(window: Window): void {
        // const index = this.floating.indexOf(window);
        // if (index >= 0) {
        //     this.floating.splice(index, 1);
        // }
    }

    private _removeTilingWindow(window: Window): void {
        const layout = window.tilingState!.parent!;
        layout.removeWindow(window);
        // If there is only one child left in the layout, replace the layout by the child node.
        if (layout.children.length === 1 && layout.parent) {
            this._replaceLayout(layout, layout.children[0].node);
        }
    }

    private _replaceLayout(layout: TilingLayout, newNode: Node): void {
        const parent = layout.parent!;
        const parentIndex = parent.children.findIndex(
            ({ node }) => node.kind === 'layout' && node.layout === layout,
        );
        parent.children[parentIndex].node = newNode;
        this._setParent(newNode, parent);
        if (newNode.kind === 'layout' && isSplit(parent)) {
            this._homogenize(parent);
        }
    }

    private _setParent(node: Node, parent: TilingLayout) {
        switch (node.kind) {
            case 'layout':
                node.layout.parent = parent;
                break;
            case 'window':
                node.window.tilingState!.parent = parent;
                break;
        }
    }

    /**
     * If the given layout has children that are layouts of the same type, incorporates these
     * children into the layout.
     */
    private _homogenize(layout: SplitLayout): void {
        for (const child of [...layout.children]) {
            if (child.node.kind === 'layout' && child.node.layout.type === layout.type) {
                const index = layout.children.indexOf(child);
                const subChildren = child.node.layout.children;
                subChildren.forEach((subChild) => {
                    this._setParent(subChild.node, layout);
                    subChild.size *= child.size;
                });
                layout.children.splice(index, 1, ...subChildren);
            }
        }
    }

    private _getTargetState(window: Window): WindowState {
        if (window.tilingState?.state) {
            return window.tilingState.state;
        } else {
            return this.config.defaultWindowState;
        }
    }

    floatWindow(window: Window): void {
        if (window.tilingState?.state === 'tiling') {
            this._removeTilingWindow(window);
        }
        window.tilingState!.state = 'floating';
        // this.floating.push(window);
        if (window.tilingState!.restoreRect) {
            const rect = window.tilingState!.restoreRect;
            window.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
            window.tilingState!.restoreRect = null;
        }
    }

    tileWindow(window: Window): boolean {
        if (window.get_maximized()) {
            window.unmaximize(Meta.MaximizeFlags.BOTH);
        }
        if (!window.allows_resize()) {
            return false;
        }
        window.tilingState!.state = 'tiling';
        window.tilingState!.restoreRect = window.get_frame_rect();
        let layout = this.tiling;
        while (layout.children.length > 0 && layout.children[0].node.kind === 'layout') {
            layout = layout.children[0].node.layout;
        }
        if (layout.children.length === 0 || layout.type === this.config.defaultLayout) {
            // Add the window to the existing layout.
            layout.insertWindow(window);
            layout.updatePositionAndSize();
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
        return true;
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
        node: Node;
    }[] = [];

    constructor(
        root: RootLayout,
        parent: BaseLayout['parent'],
        public type: 'split-h' | 'split-v',
    ) {
        super(root, parent);
    }

    insertWindow(window: Window): void {
        this.children.push({ size: 1 / this.children.length, node: { kind: 'window', window } });
        normalizeSizes(this.children);
        window.tilingState!.state = 'tiling';
        window.tilingState!.parent = this;
    }

    removeWindow(window: Window): void {
        const index = this.children.findIndex(
            ({ node }) => node.kind === 'window' && node.window === window,
        );
        if (index < 0) {
            throw new Error('window not in layout');
        }
        this.children.splice(index, 1);
        normalizeSizes(this.children);
        window.tilingState!.parent = null;
    }

    updatePositionAndSize(rect: Meta.Rectangle = this.rect!): void {
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
    children: { node: WindowNode }[] = [];

    constructor(root: RootLayout, parent: BaseLayout['parent']) {
        super(root, parent);
    }

    insertWindow(window: Window): void {
        this.children.push({ node: { kind: 'window', window } });
        window.tilingState!.state = 'tiling';
        window.tilingState!.parent = this;
    }

    removeWindow(window: Window): void {
        const index = this.children.findIndex(({ node }) => node.window === window);
        if (index >= 0) {
            this.children.splice(index, 1);
            window.tilingState!.parent = null;
        }
    }

    updatePositionAndSize(rect: Meta.Rectangle = this.rect!): void {
        this.rect = rect;
        for (const child of this.children) {
            child.node.window.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
        }
    }
}

function isSplit(layout: TilingLayout): layout is SplitLayout {
    return layout.type === 'split-h' || layout.type === 'split-v';
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

function normalizeSizes(children: { size: number }[]): void {
    const sum = children.reduce((sum, { size }) => sum + size, 0);
    children.forEach((child) => (child.size /= sum));
}
