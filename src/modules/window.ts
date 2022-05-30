import { Meta } from 'imports/gi';
import { Layout, RootLayout, TilingLayout } from 'modules/layout';

export type WindowState = {
    rootLayout: RootLayout;
} & (
    | {
          state: 'tiling';
          parent: TilingLayout;
      }
    | {
          state: 'floating';
      }
);

export interface Window extends Meta.Window {
    tilingState?: WindowState;
}
