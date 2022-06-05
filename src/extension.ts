import { LayoutManager } from 'services/LayoutManager';
import { Settings } from 'services/Settings';
import { KeyBindings } from 'services/KeyBindings';
import { WindowTracker } from 'services/WindowTracker';

class Extension {
    enable() {
        Settings.init();
        LayoutManager.init();
        WindowTracker.init();
        KeyBindings.init();
    }

    disable() {
        Settings.destroy();
        LayoutManager.destroy();
        WindowTracker.destroy();
        KeyBindings.destroy();
    }
}

function init() {
    return new Extension();
}
