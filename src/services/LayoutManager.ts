import { Meta } from 'imports/gi';
import { Direction, LayoutConfig, RootLayout } from 'modules/layout';
import { Settings } from 'services/Settings';
import { Window } from 'types/extended/window';
const AltTab = imports.ui.altTab;

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
        window = this._getRootWindow(window);
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

    toggleFloatingFocus(): void {
        if (this._anyFloatingWindowInFrontOfTiling()) {
            this.lowerAllFloatingWindows();
        } else {
            this.raiseAllFloatingWindows();
        }
    }

    /**
     * Raises all floating windows above tiling windows on the current workspace including windows
     * an all workspaces and marks them always-on-top.
     */
    raiseAllFloatingWindows(): void {
        const floatingWindows = this._getAllWindowsOnCurrentWorkspace().filter(
            (window) => window.tilerLayoutState?.state === 'floating',
        );
        // Mark all floating windows always-on-top.
        //
        // Do so in reverse order, so more recent windows will not be lowered behind older ones.
        floatingWindows
            .slice()
            .reverse()
            .forEach((window) => window.make_above());
        // Focus the most recent floating window.
        floatingWindows[0]?.focus(global.get_current_time());
    }

    /**
     * Lower all floating windows behind tiling windows on the current workspace including windows
     * on all workspaces.
     */
    lowerAllFloatingWindows(): void {
        const allWindows = this._getAllWindowsOnCurrentWorkspace();
        // Unset the always-on-top flag for all windows.
        //
        // Do so in reverse order, so more recent windows will not be lowered behind older ones.
        allWindows
            .slice()
            .reverse()
            .forEach((window) => window.unmake_above());
        // Lower floating windows.
        allWindows
            .filter((window) => window.tilerLayoutState?.state === 'floating')
            .forEach((window) => window.lower_with_transients(global.get_current_time()));
        // Focus the most recent tiling window.
        allWindows
            .find((window) => window.tilerLayoutState?.state === 'tiling')
            ?.focus(global.get_current_time());
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

    focusDirection(direction: Direction, mode: 'only-stacking' | 'all' = 'all'): void {
        const focusWindow: Window = this._getRootWindow(global.display.focus_window);
        if (focusWindow) {
            focusWindow.tilerLayoutState?.rootLayout?.focusDirection(focusWindow, direction, mode);
        }
    }

    moveFocusedWindow(direction: Direction): void {
        const focusWindow: Window = this._getRootWindow(global.display.focus_window);
        if (focusWindow) {
            focusWindow.tilerLayoutState?.rootLayout?.moveWindow(focusWindow, direction);
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

    /**
     * In case `window` is transient for another window, returns to top-most window of the chain.
     */
    private _getRootWindow(window: Window): Window {
        while (true) {
            const parent = window.get_transient_for();
            if (parent) {
                window = parent;
            } else {
                return window;
            }
        }
    }

    /**
     * Returns true if any floating window is rendered in front of any tiling window on any monitor
     * on the current workspace.
     */
    private _anyFloatingWindowInFrontOfTiling(): boolean {
        const allWindows = this._getAllWindowsOnCurrentWorkspace();
        const allMonitors = [...new Set(allWindows.map((window) => window.get_monitor()))];
        for (const monitor of allMonitors) {
            const allWindowsOnMonitor = allWindows.filter(
                (window) => window.get_monitor() === monitor,
            );
            let sawFloatingWindow = false;
            for (const window of allWindowsOnMonitor) {
                if (window.tilerLayoutState?.state === 'floating') {
                    sawFloatingWindow = true;
                } else if (window.tilerLayoutState?.state === 'tiling') {
                    if (sawFloatingWindow) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private _getAllWindowsOnCurrentWorkspace(): Window[] {
        const workspace = global.workspace_manager.get_active_workspace();
        return AltTab.getWindows(workspace).filter((window: Window) => !window.get_transient_for());
    }
}
