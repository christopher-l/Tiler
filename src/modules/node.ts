import { Meta } from 'imports/gi';
import { TilingLayout } from 'modules/layout';
import { Window } from 'types/extended/window';

let nextNodeId = 0;

abstract class BaseNode {
    abstract kind: 'layout' | 'window';
    abstract parent: LayoutNode | null;
    lastFocusTime?: number;
    id = nextNodeId++;

    isDescendentOf(node: LayoutNode): boolean {
        let parent = this.parent;
        while (parent) {
            if (parent === node) {
                return true;
            }
            parent = parent.parent;
        }
        return false;
    }

    findAncestor<S extends LayoutNode>(predicate: (node: LayoutNode) => node is S): S | undefined {
        let ancestor = this.parent;
        while (ancestor) {
            if (predicate(ancestor)) {
                return ancestor;
            }
            ancestor = ancestor.parent;
        }
    }
}

export class LayoutNode<T extends TilingLayout = TilingLayout> extends BaseNode {
    readonly kind = 'layout';

    constructor(public parent: LayoutNode | null, public layout: T) {
        super();
    }

    debug(level = 0): void {
        const indent = ' '.repeat(level * 2);
        console.log(
            indent + `Node ${this.id} ${this.kind} ${this.layout.type}:`,
            this.layout.rect!.x,
            this.layout.rect!.y,
            this.layout.rect!.width,
            this.layout.rect!.height,
        );
        this.layout.children.forEach((child) => {
            console.log(indent + `${(child as any).size}:`);
            child.node.debug(level + 1);
            if (child.node.parent !== this) {
                console.log(indent + `  ** PARENT DOES NOT MATCH **`);
            }
        });
    }

    insertWindow(window: Window, index?: number): void {
        const node = new WindowNode(this, window);
        this.layout.insertNode(node, index);
        window.tilerLayoutState!.node = node;
        // window.tilerLayoutState!.state = 'tiling';
    }
}

interface TargetPosition {
    x: number;
    y: number;
    width: number;
    height: number;
    maximized: boolean;
}

export class WindowNode extends BaseNode {
    readonly kind = 'window';
    targetPosition: TargetPosition;
    /** Whether the window is currently being resized by us. */
    resizing = false;

    constructor(public parent: LayoutNode, public window: Window) {
        super();
        const { x, y, width, height } = window.get_frame_rect();
        this.targetPosition = {
            x,
            y,
            width,
            height,
            maximized: !!window.get_maximized(),
        };
    }

    debug(level = 0): void {
        const indent = ' '.repeat(level * 2);
        console.log(indent + `Node ${this.kind} ${this.window.get_id()}`);
    }

    async resize(targetPosition: TargetPosition): Promise<void> {
        const { x, y, width, height, maximized } = targetPosition;
        const currentFrame = this.window.get_frame_rect();
        if (
            x === currentFrame.x &&
            y === currentFrame.y &&
            width === currentFrame.width &&
            height === currentFrame.height &&
            maximized === !!this.window.get_maximized()
        ) {
            return;
        } else if (width !== currentFrame.width || height !== currentFrame.height) {
            this.resizing = true;
        }
        console.log('resize', this.window.get_id());
        // if (this.window.tilerLayoutState?.currentGrabOp) {
        //     return;
        // }
        if ([x, y, width, height].some(isNaN)) {
            throw new Error(
                `Called resizeWindow x: ${x}, y: ${y}, width: ${width}, height: ${height}`,
            );
        }
        this.targetPosition = targetPosition;
        if (maximized) {
            if (this.window.get_maximized() !== Meta.MaximizeFlags.BOTH) {
                this.window.maximize(Meta.MaximizeFlags.BOTH);
            }
        } else {
            if (this.window.get_maximized()) {
                this.window.unmaximize(Meta.MaximizeFlags.BOTH);
            }
            this.window.move_resize_frame(false, x, y, width, height);
        }
    }

    afterSizeChanged(): void {
        this.resizing = false;
    }

    resetSizeAndPosition(): void {
        console.log('resetSizeAndPosition', this.window.get_id());
        this.resize(this.targetPosition);
    }

    // removeFromTree(): void {
    //     const parent = this.parent;
    //     parent.layout.removeWindow(this.window);
    //     this.window.tilerLayoutState!.node = null;
    //     // If there is only one child left in the layout, replace the layout by the child node.
    //     if (parent.layout.children.length === 1 && parent.parent) {
    //         parent.replaceLayout(parent.layout.children[0].node);
    //     }
    // }
}

export type Node = LayoutNode | WindowNode;
