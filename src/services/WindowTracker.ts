import { LayoutManager } from 'services/LayoutManager';
import { Settings } from 'services/Settings';
import { Window } from 'types/extended/window';
import { DebouncingNotifier } from 'utils/DebouncingNotifier';
import { GLib } from 'imports/gi';

// Some code adapted from
// https://github.com/jmmaranan/forge/blob/7930bf0aa3ef0ac5a1b021a25701bb39897316fd/window.js

export class WindowTracker {
    private static _instance: WindowTracker | null;

    static init() {
        WindowTracker._instance = new WindowTracker();
        WindowTracker._instance._init();
    }

    static destroy() {
        WindowTracker._instance?._destroy();
        WindowTracker._instance = null;
    }

    static getInstance(): WindowTracker {
        return WindowTracker._instance as WindowTracker;
    }

    private readonly _settings = Settings.getInstance();
    private readonly _layoutManager = LayoutManager.getInstance();
    private _displaySignals: number[] | null = null;

    private _init() {
        WindowTracker._instance = this;
        this._bindSignals();
        global.display.list_all_windows().forEach((window) => this._trackWindow(window));
    }

    private _destroy() {
        this._displaySignals?.forEach((signal) => global.display.disconnect(signal));
        this._displaySignals = null;
        global.display.list_all_windows().forEach((window) => this._untrackWindow(window));
    }

    private _bindSignals(): void {
        const display = global.display;
        this._displaySignals = [
            display.connect('window-created', (_, window) => this._trackWindow(window)),
            display.connect('window-entered-monitor', (_, monitor, window) =>
                (window as Window).tilerTracking?.updateNotifier.notify(),
            ),
        ];
    }

    /** Called for all new windows and existing windows when the extension is enabled. */
    private _trackWindow(window: Window): void {
        console.log('track window', window.get_id());
        const updateNotifier = new DebouncingNotifier();
        const windowActor = window.get_compositor_private();
        window.tilerTracking = {
            windowSignals: [
                window.connect('workspace-changed', () => updateNotifier.notify()),
                window.connect('notify::on-all-workspaces', () => updateNotifier.notify()),
                window.connect('workspace-changed', () => updateNotifier.notify()),
                // window.connect('position-changed', () =>
                //     console.log('position-changed', window.get_id(), window.get_monitor()),
                // ),
            ],
            actorSignals: [windowActor.connect('destroy', () => this._untrackWindow(window))],
            updateNotifier,
        };
        updateNotifier.subscribe(() => this._layoutManager.updateWindow(window));
        // Initially update the window layout slightly delayed since (some?) windows are being
        // positioned after being created.
        GLib.timeout_add(GLib.PRIORITY_DEFAULT, 100, () => {
            updateNotifier.notify();
            return GLib.SOURCE_REMOVE;
        });
    }

    /** Called when windows are destroyed or the extension is disabled. */
    private _untrackWindow(window: Window): void {
        console.log('untrack window', window.get_id());
        window.tilerTracking?.windowSignals.forEach((signal) => window.disconnect(signal));
        window.tilerTracking?.actorSignals.forEach((signal) =>
            window.get_compositor_private()?.disconnect(signal),
        );
        window.tilerTracking?.updateNotifier.destroy();
        delete window.tilerTracking;
        window.tilerLayoutState?.rootLayout?.removeWindow(window);
        delete window.tilerLayoutState;
    }

    private _onWorkspaceChanged(window: Window): void {
        console.log('workspace changed', window.get_id(), window.get_workspace().index());
        console.log('  monitor', window.get_monitor());
    }

    private _onEnteredMonitor(window: Window): void {}
}
