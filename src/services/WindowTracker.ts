import { LayoutManager } from 'services/LayoutManager';
import { Settings } from 'services/Settings';
import { Window } from 'types/extended/window';
import { DebouncingNotifier } from 'utils/DebouncingNotifier';
import { timeout } from 'utils/utils';

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
            display.connect('window-entered-monitor', (_, monitor, window: Window) =>
                window.tilerTracking?.updateNotifier.notify(),
            ),
            display.connect('grab-op-begin', (_, window: Window, grabOp) => {
                if (window.tilerLayoutState) {
                    window.tilerLayoutState.currentGrabOp = grabOp;
                }
            }),
            display.connect('grab-op-end', (_, window: Window, grabOp) => {
                window.tilerLayoutState?.rootLayout?.onDragEnd(window);
                // Shortly keep `currentGrabOp` since some size-changed events might come in after
                // `grab-op-end`.
                timeout(() => {
                    if (window.tilerLayoutState?.currentGrabOp) {
                        delete window.tilerLayoutState.currentGrabOp;
                    }
                }, 100);
            }),
        ];
    }

    /** Called for all new windows and existing windows when the extension is enabled. */
    private async _trackWindow(window: Window): Promise<void> {
        console.log('track window', window.get_id());
        // FIXME: possibly dangling signal if the extension is disabled while the window exists but
        // has somehow not yet been shown.
        const shownSignal = window.connect('shown', () => {
            window.disconnect(shownSignal);
            const updateNotifier = new DebouncingNotifier();
            const windowActor = window.get_compositor_private();
            window.tilerTracking = {
                windowSignals: [
                    window.connect('workspace-changed', () => updateNotifier.notify()),
                    window.connect('notify::on-all-workspaces', () => updateNotifier.notify()),
                    window.connect('workspace-changed', () => updateNotifier.notify()),
                    window.connect('focus', () =>
                        window.tilerLayoutState?.rootLayout?.onWindowFocus(window),
                    ),
                    window.connect('position-changed', () => {
                        window.tilerLayoutState?.rootLayout?.onWindowPositionChanged(window);
                    }),
                    window.connect('size-changed', () => {
                        window.tilerLayoutState?.rootLayout?.onWindowSizeChanged(window);
                        window.tilerLayoutState?.node?.afterSizeChanged();
                    }),
                ],
                actorSignals: [windowActor.connect('destroy', () => this._untrackWindow(window))],
                updateNotifier,
            };
            updateNotifier.subscribe(() => this._layoutManager.updateWindow(window));
            updateNotifier.notify();
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
