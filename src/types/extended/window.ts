import { Meta } from 'imports/gi';
import { LayoutNode, RootLayout, WindowNode, WindowState } from 'modules/layout';
import { DebouncingNotifier } from 'utils/DebouncingNotifier';

export type WindowTilingState = {
    rootLayout?: RootLayout | null;
    state?: WindowState;
    node?: WindowNode | null // Set when state: 'tiling'
    restoreRect?: Meta.Rectangle | null;
};

export type TilingWindowState = {};

export type FloatingWindowState = {
    state: 'floating';
};

export interface Window extends Meta.Window {
    tilerLayoutState?: WindowTilingState | null;
    tilerTracking?: {
        actorSignals: number[];
        windowSignals: number[];
        updateNotifier: DebouncingNotifier;
    };
    // get_compositor_private: () => Clutter.Actor;
}
