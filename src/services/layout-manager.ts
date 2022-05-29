import { Meta } from 'imports/gi';
import { Settings } from 'services/settings';
import { RootLayout } from 'utils/layout';

interface Workspace extends Meta.Workspace {
    layouts?: LayoutsMap;
}

type LayoutsMap = { [monitor in number | 'primary']?: RootLayout };

export class LayoutManager {
    private static _instance: LayoutManager | null;

    static init() {
        LayoutManager._instance = new LayoutManager();
        LayoutManager._instance.init();
    }

    static destroy() {
        LayoutManager._instance?.destroy();
        LayoutManager._instance = null;
    }

    static getInstance(): LayoutManager {
        return LayoutManager._instance as LayoutManager;
    }

    private readonly _settings = Settings.getInstance();
    private _layouts: LayoutsMap = {};

    init() {
        LayoutManager._instance = this;
    }

    destroy() {}

    getLayout(monitor: number, workspace?: Workspace): RootLayout {
        let layoutsMap: LayoutsMap;
        if (workspace) {
            workspace.layouts ??= {};
            layoutsMap = workspace.layouts;
        } else {
            layoutsMap = this._layouts;
        }
        if (global.display.get_primary_monitor() === monitor) {
            layoutsMap.primary ??= new RootLayout(this._settings.defaultTilingMode.value);
            return layoutsMap.primary;
        } else {
            layoutsMap[monitor] ??= new RootLayout(this._settings.defaultTilingMode.value);
            return layoutsMap[monitor] as RootLayout;
        }
    }
}
