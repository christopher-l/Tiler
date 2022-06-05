import { Meta, Shell } from 'imports/gi';
import { LayoutManager } from 'services/LayoutManager';
import { Settings } from 'services/Settings';
const Main = imports.ui.main;

export class KeyBindings {
    private static _instance: KeyBindings | null;

    static init() {
        KeyBindings._instance = new KeyBindings();
        KeyBindings._instance.init();
    }

    static destroy() {
        KeyBindings._instance?.destroy();
        KeyBindings._instance = null;
    }

    static getInstance(): KeyBindings {
        return KeyBindings._instance as KeyBindings;
    }

    private readonly _settings = Settings.getInstance();
    private readonly _layoutManager = LayoutManager.getInstance();
    private _addedKeyBindings: string[] = [];

    init() {
        this._addExtensionKeyBindings();
        KeyBindings._instance = this;
    }

    destroy() {
        for (const name of this._addedKeyBindings) {
            this._removeKeybinding(name);
        }
        this._addedKeyBindings = [];
    }

    addKeyBinding(name: string, handler: () => void) {
        Shell.ActionMode;
        Main.wm.addKeybinding(
            name,
            this._settings.shortcutsSettings,
            Meta.KeyBindingFlags.NONE,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            handler,
        );
        this._addedKeyBindings.push(name);
    }

    private _removeKeybinding(name: string) {
        if (this._addedKeyBindings.includes(name)) {
            Main.wm.removeKeybinding(name);
            this._addedKeyBindings.splice(this._addedKeyBindings.indexOf(name), 1);
        }
    }

    private _addExtensionKeyBindings() {
        this.addKeyBinding('toggle-floating', () => this._layoutManager.toggleFloating());
    }
}