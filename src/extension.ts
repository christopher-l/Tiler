import { LayoutManager } from 'services/LayoutManager';
import { Settings } from 'services/Settings';
import { KeyBindings } from 'services/KeyBindings';
import { WindowTracker } from 'services/WindowTracker';
import { ScrollHandler } from 'services/ScrollHandler';

class Extension {
    enable() {
        console.log('init');
        Settings.init();
        LayoutManager.init();
        WindowTracker.init();
        KeyBindings.init();
        ScrollHandler.init();
    }

    disable() {
        console.log('destroy');
        Settings.destroy();
        LayoutManager.destroy();
        WindowTracker.destroy();
        KeyBindings.destroy();
        ScrollHandler.destroy();
    }
}

function init() {
    return new Extension();
}
