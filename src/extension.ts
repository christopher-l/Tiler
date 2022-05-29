import { Settings } from 'services/Settings';

class Extension {
    enable() {
        Settings.init();
    }

    disable() {
        Settings.destroy();
    }
}

function init() {
    return new Extension();
}
