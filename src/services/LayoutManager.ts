import { Meta } from 'imports/gi';
import { Settings } from 'services/Settings';
import { LayoutConfig, RootLayout } from 'modules/layout';
import { Window } from 'modules/window';

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

    toggleFloating(window: Window = global.display.get_focus_window()): void {
        const monitor = window.get_monitor();
        const workspace = window.is_on_all_workspaces() ? undefined : window.get_workspace();
        const layout = this._getLayout(monitor, workspace);
        layout.tileWindow(window);
    }

    private _getLayout(monitor: number, workspace?: Workspace): RootLayout {
        let layoutsMap: LayoutsMap;
        if (workspace) {
            workspace.layouts ??= {};
            layoutsMap = workspace.layouts;
        } else {
            layoutsMap = this._layouts;
        }
        if (global.display.get_primary_monitor() === monitor) {
            layoutsMap.primary ??= new RootLayout(this._getLayoutConfig(monitor));
            return layoutsMap.primary;
        } else {
            layoutsMap[monitor] ??= new RootLayout(this._getLayoutConfig(monitor));
            return layoutsMap[monitor] as RootLayout;
        }
    }

    private _getLayoutConfig(monitor: number): LayoutConfig {
        return {
            defaultLayout: this._settings.defaultLayout.value,
            gapSize: this._settings.gapSize.value,
            rootRect: global.workspace_manager
                .get_active_workspace()
                .get_work_area_for_monitor(monitor),
        };
    }
}
