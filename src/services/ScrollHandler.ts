import { Clutter, Shell, Meta } from 'imports/gi';
import { LayoutManager } from 'services/LayoutManager';
const Main = imports.ui.main;
const wm = imports.ui.windowManager;
const WindowManager = wm.WindowManager;
const AltTab = imports.ui.altTab;

type Window = Meta.Window;

export class ScrollHandler {
    private static _instance: ScrollHandler | null;

    static init() {
        ScrollHandler._instance = new ScrollHandler();
        ScrollHandler._instance.init();
    }

    static destroy() {
        ScrollHandler._instance?.destroy();
        ScrollHandler._instance = null;
    }

    static getInstance(): ScrollHandler {
        return ScrollHandler._instance as ScrollHandler;
    }

    private readonly _layoutManager = LayoutManager.getInstance();
    private _superScrollBinding: number | null = null;
    private _originalHandleWorkspaceScroll: any = null;

    init() {
        ScrollHandler._instance = this;
        this._registerSuperScrollBinding();
    }

    destroy() {
        this._unregisterSuperScrollBinding();
    }

    private _registerSuperScrollBinding() {
        this._superScrollBinding = global.stage.connect(
            'scroll-event',
            (stage, event: Clutter.Event) => {
                const allowedModes = Shell.ActionMode.NORMAL;
                if ((allowedModes & Main.actionMode) === 0) {
                    return Clutter.EVENT_PROPAGATE;
                } else if ((event.get_state() & global.display.compositor_modifiers) === 0) {
                    return Clutter.EVENT_PROPAGATE;
                } else {
                    return this._handleScroll(event);
                }
            },
        );
        this._originalHandleWorkspaceScroll = WindowManager.prototype.handleWorkspaceScroll;
        const self = this;
        WindowManager.prototype.handleWorkspaceScroll = function (event: Clutter.Event) {
            if (Main.overview.visible) {
                return self._originalHandleWorkspaceScroll.apply(this, [event]);
            } else {
                return Clutter.EVENT_PROPAGATE;
            }
        };
    }

    private _unregisterSuperScrollBinding() {
        if (this._superScrollBinding) {
            global.stage.disconnect(this._superScrollBinding);
            this._superScrollBinding = null;
        }
        if (this._originalHandleWorkspaceScroll) {
            WindowManager.prototype.handleWorkspaceScroll = this._originalHandleWorkspaceScroll;
            this._originalHandleWorkspaceScroll = null;
        }
    }

    private _handleScroll(event: Clutter.Event): boolean {
        const direction = event.get_scroll_direction();
        if (direction === Clutter.ScrollDirection.SMOOTH) {
            return Clutter.EVENT_PROPAGATE;
        }
        switch (direction) {
            case Clutter.ScrollDirection.UP:
                this._focusWindowUnderCursor();
                this._layoutManager.focusDirection('up', 'only-stacking');
                return Clutter.EVENT_STOP;
            case Clutter.ScrollDirection.DOWN:
                this._focusWindowUnderCursor();
                this._layoutManager.focusDirection('down', 'only-stacking');
                return Clutter.EVENT_STOP;
            default:
                return Clutter.EVENT_PROPAGATE;
        }
    }

    private _focusWindowUnderCursor() {
        const focusWindow = global.display.get_focus_window();
        if (!this._isWindowUnderCursor(focusWindow)) {
            this._getWindowUnderCursor()?.focus(global.get_current_time());
        }
    }

    private _getWindowUnderCursor(): Window | null {
        const workspace = global.workspace_manager.get_active_workspace();
        return AltTab.getWindows(workspace).find((window: Window) =>
            this._isWindowUnderCursor(window),
        );
    }

    private _isWindowUnderCursor(window: Window): boolean {
        const [mouseX, mouseY] = global.get_pointer();
        const rect = window.get_buffer_rect();
        return (
            mouseX >= rect.x &&
            mouseX <= rect.x + rect.width &&
            mouseY >= rect.y &&
            mouseY <= rect.y + rect.height
        );
    }
}
