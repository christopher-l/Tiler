import { createTilingLayout, TilingLayout, TilingType } from 'modules/layout';
import { Window } from 'types/extended/window';

abstract class BaseNode {
    abstract kind: 'layout' | 'window';
    abstract parent: LayoutNode | null;
    lastFocusTime?: number;
}

export class LayoutNode<T extends TilingLayout = TilingLayout> extends BaseNode {
    readonly kind = 'layout';

    constructor(public parent: LayoutNode | null, public layout: T) {
        super();
    }

    debug(level = 0): void {
        const indent = ' '.repeat(level * 2);
        console.log(indent + `Node ${this.kind} ${this.layout.type}:`);
        this.layout.children.forEach((child) => {
            child.node.debug(level + 1);
            if (child.node.parent !== this) {
                console.log(indent + `  ** PARENT DOES NOT MATCH **`);
            }
            // console.log(indent + `  (${(child as any).size})`);
        });
    }

    insertWindow(window: Window, layoutType: TilingType): void {
        // TODO: insert at current focus position
        let node: LayoutNode = this;
        while (
            node.kind === 'layout' &&
            node.layout.children.length > 0 &&
            node.layout.children[0].node.kind === 'layout'
        ) {
            node = node.layout.children[0].node;
        }
        if (node.layout.children.length === 0 || node.layout.type === layoutType) {
            // Add the window to the existing layout.
            console.log('add to existing', window.get_id());
            // this.debug();
            node.insertWindowHere(window);
            node.layout.updatePositionAndSize();
        } else if (node.layout.children[0]?.node.kind === 'window') {
            node.layout.children[0].node.insertWindow(window, layoutType);
        } else {
            throw new Error('unreachable');
        }
    }

    insertWindowHere(window: Window): void {
        const node = new WindowNode(this, window);
        this.layout.insertNode(node);
        window.tilerLayoutState!.node = node;
        // window.tilerLayoutState!.state = 'tiling';
    }
}

export class WindowNode extends BaseNode {
    readonly kind = 'window';

    constructor(public parent: LayoutNode, public window: Window) {
        super();
    }

    debug(level = 0): void {
        const indent = ' '.repeat(level * 2);
        console.log(indent + `Node ${this.kind} ${this.window.get_id()}`);
    }

    /**
     * Replaces the first window of the existing layout with the default layout, holding the
     * existing window and the new one.
     */
    insertWindow(window: Window, layoutType: TilingType): void {
        const nodeWindow = this.window;
        const index = this.parent.layout.children.findIndex((child) => child.node === this);
        const newLayout = createTilingLayout(layoutType);
        const newNode = new LayoutNode(this.parent, newLayout);
        newNode.insertWindowHere(nodeWindow);
        newNode.insertWindowHere(window);
        this.parent.layout.children[index].node = newNode;
        newLayout.updatePositionAndSize(nodeWindow.get_frame_rect(), this.parent.layout.gapSize);
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
