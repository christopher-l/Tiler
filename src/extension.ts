import { LayoutManager } from 'services/layout-manager';
import { Settings } from 'services/settings';

class Extension {
    enable() {
        Settings.init();
        LayoutManager.init();
    }

    disable() {
        Settings.destroy();
        LayoutManager.destroy();
    }
}

function init() {
    return new Extension();
}
