import { Meta } from 'imports/gi';
import { LayoutNode, Node, WindowNode } from 'modules/node';
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

export class RootLayout {
    // floating: Window[] = [];
    tiling = new LayoutNode(null, createTilingLayout(this.config.defaultLayout));

    constructor(public config: LayoutConfig) {
        this.tiling.layout.updatePositionAndSize(
            subtractGaps(this.config.rootRect, this.config.gapSize),
            config.gapSize,
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
            resizeWindow(window, rect);
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
        this._insertUnderNode(window);
        return true;
    }

    onWindowFocus(window: Window): void {
        let node: Node | null | undefined = window.tilerLayoutState?.node;
        while (node) {
            node.lastFocusTime = global.get_current_time();
            node = node.parent;
        }
    }

    private _insertUnderNode(window: Window, node: Node = this.tiling): void {
        let index = -1;
        while (node.kind === 'layout') {
            const mostRecentlyFocusedChild = node.layout.getMostRecentlyFocusedChild();
            if (mostRecentlyFocusedChild) {
                ({ node, index } = mostRecentlyFocusedChild);
            } else {
                // Root layout with no windows
                break;
            }
        }
        const parent = node.parent || this.tiling;
        if (
            node.kind === 'layout' ||
            // this._isRoot(parent) ||
            parent.layout.type === this.config.defaultLayout
        ) {
            parent.insertWindow(window, index + 1);
            parent.layout.updatePositionAndSize();
        } else {
            this._insertUnderWindowNode(window, node);
        }
    }
    /**
     * Replaces the window with the default layout, holding the existing window and the new one.
     */
    private _insertUnderWindowNode(window: Window, node: WindowNode): void {
        const nodeWindow = node.window;
        const index = node.parent.layout.children.findIndex((child) => child.node === node);
        const newLayout = createTilingLayout(this.config.defaultLayout);
        const newNode = new LayoutNode(node.parent, newLayout);
        newNode.insertWindow(nodeWindow);
        newNode.insertWindow(window);
        node.parent.layout.children[index].node = newNode;
        newLayout.updatePositionAndSize(nodeWindow.get_frame_rect(), this.config.gapSize);
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
        let node = window.tilerLayoutState!.node!;
        return this._focusDirection(node, direction);
    }

    private _focusDirection(node: Node, direction: Direction): boolean {
        while (node.parent) {
            let nodeToFocus = node.parent!.layout.getChildByDirection(node, direction);
            if (nodeToFocus) {
                this._focus(nodeToFocus);
                return true;
            }
            node = node.parent;
        }
        return false;
    }

    private _focus(node: Node): void {
        if (node.kind === 'window') {
            node.window.focus(global.get_current_time());
            node.window.raise();
        } else {
            const mostRecentlyFocusedChild = node.layout.getMostRecentlyFocusedChild();
            if (mostRecentlyFocusedChild) {
                this._focus(mostRecentlyFocusedChild.node);
            }
        }
    }

    /**
     * Moves a tiled window within the layout.
     *
     * @returns `false` if the window cannot be moved any further in the given direction within the
     * layout.
     */
    moveWindow(window: Window, direction: Direction): boolean {
        console.log('-----------------');
        console.log('--- moveWindow');
        console.log('-----------------');
        this.tiling.debug();
        console.log('-----------------');
        if (window.tilerLayoutState!.state !== 'tiling') {
            return false;
        }
        const windowNode = window.tilerLayoutState!.node!;
        const parent = windowNode.parent;
        if (this._isRoot(parent) && parent.layout.children.length <= 1) {
            return false;
        }
        const couldInsertIntoSibling = this._insertIntoSiblingByDirection(
            windowNode,
            windowNode,
            direction,
        );
        if (couldInsertIntoSibling) {
            return true;
        }
        const couldMoveWithinLayout = windowNode.parent.layout.moveChild(windowNode, direction);
        if (couldMoveWithinLayout) {
            console.log('move within layout');
            windowNode.parent.layout.updatePositionAndSize();
            this.tiling.debug();
            return true;
        }
        const layoutType = ['up', 'down'].includes(direction) ? 'split-v' : 'split-h';
        let node: LayoutNode | null = parent;
        while (node) {
            if (node.parent) {
                const couldInsert = this._insertIntoSiblingByDirection(node, windowNode, direction);
                if (couldInsert) {
                    return true;
                }
            }
            if (node.layout.type !== layoutType) {
                console.log('split move');
                this._splitMove(windowNode, node, layoutType, direction);
                return true;
            }
            node = node.parent;
        }
        console.log('Could not move window', direction);
        return false;
    }

    private _insertIntoSiblingByDirection(
        node: Node,
        windowNode: WindowNode,
        direction: Direction,
    ): boolean {
        console.log('try _insertIntoChildByDirection');
        const child = node.parent?.layout.getChildByDirection(node, direction);
        // TODO: Also insert into other layouts
        if (child && node.parent!.layout.type !== this.config.defaultLayout) {
            console.log('do _insertIntoChildByDirection', windowNode.window.get_id(), direction);
            this._removeTilingWindow(windowNode.window);
            this._insertUnderNode(windowNode.window, child);
            // Crash when creating 3 windows, moving one right and left again.
            // this._removeSingleChildLayout(parent);
            node.parent!.layout.updatePositionAndSize();
            this.tiling.debug();
            return true;
        } else {
            return false;
        }
    }

    private _splitMove(
        windowNode: WindowNode,
        parent: LayoutNode<TilingLayout>,
        layoutType: 'split-h' | 'split-v',
        direction: Direction,
    ) {
        // remove window from tree
        const windowParent = windowNode.parent;
        windowParent.layout.removeWindow(windowNode.window);
        const rect = parent.layout.rect!;
        // create new split layout (to replace parent.layout with)
        const newLayout = new SplitLayout(layoutType);
        // create new node to hold original parent layout
        const newNode = new LayoutNode(parent, parent.layout);
        // attach newNode to newLayout
        parent.layout.children.forEach((child) => (child.node.parent = newNode));
        newLayout.insertNode(newNode);
        // attach newLayout to parent
        parent.layout = newLayout;
        // attach window to newLayout
        parent.layout.insertAtDirection(windowNode, direction);
        windowNode.parent = parent;
        // cleanup
        this._removeSingleChildLayout(newNode);
        this._removeSingleChildLayout(windowParent);
        if (parent.parent && isSplitNode(parent.parent)) {
            this._homogenize(parent.parent);
            parent.parent.layout.updatePositionAndSize();
        } else {
            parent.layout.updatePositionAndSize(rect, this.config.gapSize);
        }
        this.tiling.debug();
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
        window.tilerLayoutState!.node = null;
        this._removeSingleChildLayout(parent);
    }

    /** If there is only one child left in the layout, replace the layout by the child node. */
    private _removeSingleChildLayout(node: LayoutNode): void {
        if (node.layout.children.length === 1) {
            const childNode = node.layout.children[0].node;
            if (this._isRoot(node)) {
                if (childNode.kind === 'layout') {
                    this.tiling = childNode;
                    childNode.parent = null;
                }
            } else {
                this._replaceLayout(node, childNode);
            }
            // if (node.layout.children[0].node.kind === 'layout') {
            //     const rect = node.layout.rect;
            //     node.layout = node.layout.children[0].node.layout;
            //     node.layout.rect = rect;
            //     node.layout.children.forEach((child) => (child.node.parent = node));
            // } else if (node.parent) {
            // }
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

    private _isRoot(node: Node): boolean {
        return this.tiling === node;
    }
}

export function createTilingLayout(type: TilingType): TilingLayout {
    switch (type) {
        case 'split-h':
        case 'split-v':
            return new SplitLayout(type);
        case 'stacking':
            return new StackingLayout();
    }
}

export type TilingLayout = SplitLayout | StackingLayout;

abstract class BaseLayout {
    rect?: Meta.Rectangle;
    gapSize?: number;
    abstract children: { node: Node }[];
    abstract type: 'split-v' | 'split-h' | 'stacking';

    getChildByDirection(node: Node, direction: Direction): Node | null {
        const indexDiff = this._getIndexDiff(direction);
        if (indexDiff === null) {
            return null;
        }
        const index = this._getChildIndex(node);
        const newIndex = index + indexDiff;
        if (newIndex < 0 || newIndex >= this.children.length) {
            return null;
        }
        return this.children[newIndex].node;
    }

    moveChild(node: Node, direction: Direction): boolean {
        const indexDiff = this._getIndexDiff(direction);
        if (indexDiff === null) {
            return false;
        }
        const index = this._getChildIndex(node);
        const newIndex = index + indexDiff;
        if (newIndex < 0 || newIndex >= this.children.length) {
            return false;
        }
        const [child] = this.children.splice(index, 1);
        this.children.splice(newIndex, 0, child);
        return true;
    }

    canInsertAtDirection(direction: Direction): boolean {
        return this._getIndexDiff(direction) !== null;
    }

    insertAtDirection(node: WindowNode, direction: Direction): void {
        switch (this._getIndexDiff(direction)) {
            case -1:
                this.insertNode(node, 0);
                break;
            case 1:
                this.insertNode(node);
                break;
            default:
                throw new Error(`Cannot insert in ${this.type} in direction ${direction}`);
        }
    }

    getMostRecentlyFocusedChild(): { node: Node; index: number } | null {
        return this.children.reduce((result, { node }, index) => {
            if ((result?.node.lastFocusTime ?? 0) > (node.lastFocusTime ?? 0)) {
                return result;
            } else {
                return { node, index };
            }
        }, null as { node: Node; index: number } | null);
    }

    abstract insertNode(node: WindowNode, position?: number): void;

    protected _getChildIndex(node: Node): number {
        const index = this.children.findIndex((child) => child.node === node);
        if (index < 0) {
            throw new Error('node not in layout');
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

    constructor(public type: 'split-h' | 'split-v') {
        super();
    }

    insertNode(node: Node, position = this.children.length): void {
        this.children.splice(position, 0, {
            size: 1 / (this.children.length || 1),
            node,
        });
        normalizeSizes(this.children);
    }

    removeWindow(window: Window): void {
        const index = this._getChildIndex(window.tilerLayoutState!.node!);
        this.children.splice(index, 1);
        normalizeSizes(this.children);
    }

    updatePositionAndSize(
        rect: Meta.Rectangle = this.rect!,
        gapSize: number = this.gapSize!,
    ): void {
        this.rect = rect;
        this.gapSize = gapSize;
        let offset = 0;
        let sizeAcc = 0;
        const totalTiledSize = this.type === 'split-h' ? rect.width : rect.height;
        this.children.forEach((child, index) => {
            sizeAcc += child.size;
            const tileStart = offset;
            const tileEnd =
                (totalTiledSize - (this.children.length - 1 - index) * gapSize) * sizeAcc;
            const x = this.type === 'split-h' ? tileStart + rect.x : rect.x;
            const y = this.type === 'split-v' ? tileStart + rect.y : rect.y;
            const width = this.type === 'split-h' ? tileEnd - tileStart : rect.width;
            const height = this.type === 'split-v' ? tileEnd - tileStart : rect.height;
            if (child.node.kind === 'window') {
                resizeWindow(child.node.window, { x, y, width, height });
            } else {
                child.node.layout.updatePositionAndSize(
                    createRectangle(x, y, width, height),
                    gapSize,
                );
            }
            offset = tileEnd + gapSize;
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

    insertNode(node: WindowNode, index = this.children.length): void {
        this.children.splice(index, 0, { node });
    }

    removeWindow(window: Window): void {
        const index = this._getChildIndex(window.tilerLayoutState!.node!);
        this.children.splice(index, 1);
    }

    updatePositionAndSize(rect: Meta.Rectangle = this.rect!): void {
        this.rect = rect;
        const STACKING_OFFSET = 10;
        const height = rect.height - (this.children.length - 1) * STACKING_OFFSET;
        this.children.forEach((child, index) => {
            const y = rect.y + index * STACKING_OFFSET;
            resizeWindow(child.node.window, { ...rect, y });
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

function resizeWindow(
    window: Window,
    { x, y, width, height }: { x: number; y: number; width: number; height: number },
) {
    if ([x, y, width, height].some(isNaN)) {
        throw new Error('Called resizeWindow with NaN');
    }
    window.move_resize_frame(false, x, y, width, height);
}
