import { Meta } from 'imports/gi';
import { RootLayout, TilingLayout, WindowState } from 'modules/layout';

export type WindowTilingState = {
    rootLayout?: RootLayout | null;
    state?: WindowState;
    parent?: TilingLayout | null; // Set when state: 'tiling'
    restoreRect?: Meta.Rectangle | null;
    connections?: number[];
};

export type TilingWindowState = {};

export type FloatingWindowState = {
    state: 'floating';
};

export interface Window extends Meta.Window {
    tilingState?: WindowTilingState | null;
}
