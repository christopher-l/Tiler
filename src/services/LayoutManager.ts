import { Meta, Shell } from 'imports/gi';
import { Settings } from 'services/Settings';
import { LayoutConfig, RootLayout } from 'modules/layout';
import { Window } from 'types/extended/window';
import { DebouncingNotifier } from 'utils/DebouncingNotifier';

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
    // private readonly _updateNotifier = new DebouncingNotifier();

    init() {
        LayoutManager._instance = this;
    }

    destroy() {
        // this._updateNotifier.destroy();
    }

    toggleFloating(window: Window = global.display.get_focus_window()): void {
        const currentState = window.tilerLayoutState!.state;
        const rootLayout = window.tilerLayoutState!.rootLayout!;
        switch (currentState) {
            case 'floating':
                rootLayout.tileWindow(window);
                break;
            case 'tiling':
                rootLayout.floatWindow(window);
                break;
        }
    }

    updateWindow(window: Window): void {
        const targetLayout = this._getLayoutForWindow(window);
        if (window.tilerLayoutState?.rootLayout) {
            if (window.tilerLayoutState.rootLayout !== targetLayout) {
                window.tilerLayoutState.rootLayout.removeWindow(window);
                targetLayout?.insertWindow(window);
            }
        } else if (targetLayout) {
            targetLayout.insertWindow(window);
        }
    }

    private _getLayoutForWindow(window: Window): RootLayout | null {
        let layoutsMap: LayoutsMap;
        if (window.is_on_all_workspaces()) {
            layoutsMap = this._layouts;
        } else {
            const workspace: Workspace = window.get_workspace();
            if (!workspace) {
                return null;
            }
            workspace.layouts ??= {};
            layoutsMap = workspace.layouts;
        }
        const monitor = window.get_monitor();
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
            defaultWindowState: this._settings.defaultWindowState.value,
            gapSize: this._settings.gapSize.value,
            rootRect: global.workspace_manager
                .get_active_workspace()
                .get_work_area_for_monitor(monitor),
        };
    }
}
