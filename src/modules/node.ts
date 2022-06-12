import { TilingLayout } from 'modules/layout';
import { Window } from 'types/extended/window';

abstract class BaseNode {
    abstract kind: 'layout' | 'window';
    abstract parent: LayoutNode | null;
    lastFocusTime?: number;

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
}

export class LayoutNode<T extends TilingLayout = TilingLayout> extends BaseNode {
    readonly kind = 'layout';

    constructor(public parent: LayoutNode | null, public layout: T) {
        super();
    }

    debug(level = 0): void {
        const indent = ' '.repeat(level * 2);
        console.log(
            indent + `Node ${this.kind} ${this.layout.type}:`,
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

export class WindowNode extends BaseNode {
    readonly kind = 'window';

    constructor(public parent: LayoutNode, public window: Window) {
        super();
    }

    debug(level = 0): void {
        const indent = ' '.repeat(level * 2);
        console.log(indent + `Node ${this.kind} ${this.window.get_id()}`);
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
