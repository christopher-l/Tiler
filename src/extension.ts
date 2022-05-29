import { LayoutManager } from 'services/LayoutManager';
import { Settings } from 'services/Settings';
import { KeyBindings } from 'services/KeyBindings';

class Extension {
    enable() {
        Settings.init();
        LayoutManager.init();
        KeyBindings.init();
    }

    disable() {
        Settings.destroy();
        LayoutManager.destroy();
        KeyBindings.destroy();
    }
}

function init() {
    return new Extension();
}
