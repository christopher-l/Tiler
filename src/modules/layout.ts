import { Meta } from 'imports/gi';
import { Window } from 'types/extended/window';

export type WindowState = 'floating' | 'tiling';
export type TilingType = 'split-h' | 'split-v' | 'stacking';
export type Direction = 'left' | 'right' | 'up' | 'down';

export interface LayoutConfig {
    defaultLayout: TilingType;
    defaultWindowState: WindowState;
    gapSize: number;
    rootRect: Meta.Rectangle;
}

type BaseNode = {
    parent: LayoutNode | null;
    lastFocusTime?: number;
};
export type LayoutNode<T extends TilingLayout = TilingLayout> = {
    kind: 'layout';
    layout: T;
} & BaseNode;
export type WindowNode = { kind: 'window'; window: Window } & BaseNode;
type Node = LayoutNode | WindowNode;

export class RootLayout {
    // floating: Window[] = [];
    tiling: LayoutNode = {
        parent: null,
        kind: 'layout',
        layout: createTilingLayout(this, this.config.defaultLayout),
    };

    constructor(public config: LayoutConfig) {
        this.tiling.layout.updatePositionAndSize(
            subtractGaps(this.config.rootRect, this.config.gapSize),
        );
    }

    // TODO: call this
    destroy() {}

    insertWindow(window: Window): void {
        window.tilerLayoutState = { ...(window.tilerLayoutState ?? {}), rootLayout: this };
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
    }

    removeWindow(window: Window): void {
        const parent = window.tilerLayoutState!.node!.parent;
        switch (window.tilerLayoutState!.state) {
            case 'floating':
                this._removeFloatingWindow(window);
                break;
            case 'tiling':
                this._removeTilingWindow(window);
                break;
        }
        window.tilerLayoutState!.rootLayout = null;
        if (parent) {
            parent.layout.updatePositionAndSize();
        }
    }

    floatWindow(window: Window): void {
        if (window.tilerLayoutState?.state === 'tiling') {
            this._removeTilingWindow(window);
        }
        window.tilerLayoutState!.state = 'floating';
        // this.floating.push(window);
        if (window.tilerLayoutState!.restoreRect) {
            const rect = window.tilerLayoutState!.restoreRect;
            window.move_resize_frame(false, rect.x, rect.y, rect.width, rect.height);
            window.tilerLayoutState!.restoreRect = null;
        }
    }

    tileWindow(window: Window): boolean {
        if (window.get_maximized()) {
            window.unmaximize(Meta.MaximizeFlags.BOTH);
        }
        // const windowActor = window.get_compositor_private() as Clutter.Actor;
        // windowActor.remove_all_transitions();
        if (!window.allows_resize()) {
            return false;
        }
        window.tilerLayoutState!.state = 'tiling';
        window.tilerLayoutState!.restoreRect = window.get_frame_rect();
        let node = this.tiling;
        // TODO: insert at current focus position
        while (node.layout.children.length > 0 && node.layout.children[0].node.kind === 'layout') {
            node = node.layout.children[0].node;
        }
        if (node.layout.children.length === 0 || node.layout.type === this.config.defaultLayout) {
            // Add the window to the existing layout.
            node.layout.insertWindow(window, node);
            node.layout.updatePositionAndSize();
        } else if (node.layout.children[0]?.node.kind === 'window') {
            // Replace the first window of the existing layout with the default layout, holding the
            // existing window and the new one.
            const nodeWindow = node.layout.children[0].node.window;
            const newLayout = createTilingLayout(this, this.config.defaultLayout);
            const newNode: LayoutNode = {
                parent: node,
                kind: 'layout',
                layout: newLayout,
            };
            newLayout.insertWindow(nodeWindow, newNode);
            newLayout.insertWindow(window, newNode);
            node.layout.children[0].node = newNode;
            newLayout.updatePositionAndSize(nodeWindow.get_frame_rect());
        } else {
            throw new Error('unreachable');
        }
        return true;
    }

    onWindowFocus(window: Window): void {
        if (window.tilerLayoutState?.node) {
        }
    }

    /**
     * Moves the focus from the given window to the given direction.
     *
     * @returns `false` if the focus cannot be moved any further in the given direction within the
     * layout.
     */
    focusDirection(window: Window, direction: Direction): boolean {
        if (window.tilerLayoutState!.state === 'floating') {
            return this._moveFloatingFocus(window, direction);
        }
        // Tiling
        let node = window.tilerLayoutState!.node!.parent!;
        let nodeToFocus = node.layout.getNodeByDirection(window, direction);
        if (nodeToFocus) {
            if (nodeToFocus.kind === 'window') {
                nodeToFocus.window.focus(global.get_current_time());
                nodeToFocus.window.raise();
                node.layout.updatePositionAndSize();
            } else {
                // kind: 'layout'
                // TODO
            }
            return true;
        }
        // TODO
        return false;
    }

    /**
     * Moves a tiled window within the layout.
     *
     * @returns `false` if the window cannot be moved any further in the given direction within the
     * layout.
     */
    moveWindow(window: Window, direction: Direction): boolean {
        if (window.tilerLayoutState!.state !== 'tiling') {
            return false;
        }
        let node = window.tilerLayoutState!.node!.parent!;
        const couldMoveWithinLayout = node.layout.moveWindow(window, direction);
        if (couldMoveWithinLayout) {
            node.layout.updatePositionAndSize();
            return true;
        }
        // TODO
        return false;
    }

    private _moveFloatingFocus(window: Window, direction: Direction): boolean {
        // TODO
        return false;
    }

    private _removeFloatingWindow(window: Window): void {
        // const index = this.floating.indexOf(window);
        // if (index >= 0) {
        //     this.floating.splice(index, 1);
        // }
    }

    private _removeTilingWindow(window: Window): void {
        const parent = window.tilerLayoutState!.node!.parent!;
        parent.layout.removeWindow(window);
        // If there is only one child left in the layout, replace the layout by the child node.
        if (parent.layout.children.length === 1 && parent.parent) {
            this._replaceLayout(parent, parent.layout.children[0].node);
        }
    }

    private _replaceLayout(node: LayoutNode, newNode: Node): void {
        const parentLayout = node.parent!.layout;
        const parentIndex = parentLayout.children.findIndex((child) => child.node === node);
        parentLayout.children[parentIndex].node = newNode;
        newNode.parent = node.parent;
        if (newNode.kind === 'layout' && isSplitNode(node.parent!)) {
            this._homogenize(node.parent!);
        }
    }

    /**
     * If the given node has children that are layouts of the same type, incorporates these
     * children into the layout.
     */
    private _homogenize(node: LayoutNode<SplitLayout>): void {
        for (const child of [...node.layout.children]) {
            if (child.node.kind === 'layout' && child.node.layout.type === node.layout.type) {
                const index = node.layout.children.indexOf(child);
                const subChildren = child.node.layout.children;
                subChildren.forEach((subChild) => {
                    subChild.node.parent = node;
                    subChild.size *= child.size;
                });
                node.layout.children.splice(index, 1, ...subChildren);
            }
        }
    }

    private _getTargetState(window: Window): WindowState {
        if (window.tilerLayoutState?.state) {
            return window.tilerLayoutState.state;
        } else {
            return this.config.defaultWindowState;
        }
    }
}

function createTilingLayout(root: RootLayout, type: TilingType): TilingLayout {
    switch (type) {
        case 'split-h':
        case 'split-v':
            return new SplitLayout(root, type);
        case 'stacking':
            return new StackingLayout(root);
    }
}

export type TilingLayout = SplitLayout | StackingLayout;

abstract class BaseLayout {
    rect?: Meta.Rectangle;
    abstract children: { node: Node }[];

    constructor(public root: RootLayout) {}

    getNodeByDirection(window: Window, direction: Direction): Node | null {
        const indexDiff = this._getIndexDiff(direction);
        if (indexDiff === null) {
            return null;
        }
        const index = this._getWindowIndex(window);
        const newIndex = index + indexDiff;
        if (newIndex < 0 || newIndex >= this.children.length) {
            return null;
        }
        return this.children[newIndex].node;
    }

    moveWindow(window: Window, direction: Direction): boolean {
        const indexDiff = this._getIndexDiff(direction);
        if (indexDiff === null) {
            return false;
        }
        const index = this._getWindowIndex(window);
        const newIndex = index + indexDiff;
        if (newIndex < 0 || newIndex >= this.children.length) {
            return false;
        }
        const [node] = this.children.splice(index, 1);
        this.children.splice(newIndex, 0, node);
        return true;
    }

    protected _getWindowIndex(window: Window): number {
        const index = this.children.findIndex(
            ({ node }) => node.kind === 'window' && node.window === window,
        );
        if (index < 0) {
            throw new Error('window not in layout');
        } else {
            return index;
        }
    }

    protected abstract _getIndexDiff(direction: Direction): number | null;
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

    constructor(root: RootLayout, public type: 'split-h' | 'split-v') {
        super(root);
    }

    insertWindow(window: Window, node: LayoutNode): void {
        const newNode: WindowNode = { kind: 'window', window, parent: node };
        this.children.push({
            size: 1 / (this.children.length || 1),
            node: newNode,
        });
        normalizeSizes(this.children);
        window.tilerLayoutState!.node = newNode;
        window.tilerLayoutState!.state = 'tiling';
    }

    removeWindow(window: Window): void {
        const index = this._getWindowIndex(window);
        this.children.splice(index, 1);
        normalizeSizes(this.children);
        window.tilerLayoutState!.node = null;
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

    protected _getIndexDiff(direction: Direction): number | null {
        switch (this.type) {
            case 'split-v':
                if (direction === 'left' || direction === 'right') {
                    return null;
                } else {
                    return direction === 'up' ? -1 : 1;
                }
            case 'split-h':
                if (direction === 'up' || direction === 'down') {
                    return null;
                } else {
                    return direction === 'left' ? -1 : 1;
                }
        }
    }
}

class StackingLayout extends BaseLayout {
    type: 'stacking' = 'stacking';
    children: { node: WindowNode }[] = [];

    constructor(root: RootLayout) {
        super(root);
    }

    insertWindow(window: Window, node: LayoutNode): void {
        const newNode: WindowNode = { kind: 'window', window, parent: node };
        this.children.push({ node: newNode });
        window.tilerLayoutState!.node = newNode;
        window.tilerLayoutState!.state = 'tiling';
    }

    removeWindow(window: Window): void {
        const index = this._getWindowIndex(window);
        this.children.splice(index, 1);
        window.tilerLayoutState!.node = null;
    }

    updatePositionAndSize(rect: Meta.Rectangle = this.rect!): void {
        this.rect = rect;
        const STACKING_OFFSET = 10;
        const height = rect.height - (this.children.length - 1) * STACKING_OFFSET;
        this.children.forEach((child, index) => {
            const y = rect.y + index * STACKING_OFFSET;
            child.node.window.move_resize_frame(false, rect.x, y, rect.width, height);
        });
    }

    protected _getIndexDiff(direction: Direction): number | null {
        if (direction === 'left' || direction === 'right') {
            return null;
        } else {
            return direction === 'up' ? -1 : 1;
        }
    }
}

function isSplitLayout(layout: TilingLayout): layout is SplitLayout {
    return layout.type === 'split-h' || layout.type === 'split-v';
}

function isSplitNode(node: LayoutNode): node is LayoutNode<SplitLayout> {
    return isSplitLayout(node.layout);
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
