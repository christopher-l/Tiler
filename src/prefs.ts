const Me = imports.misc.extensionUtils.getCurrentExtension();
import type { Adw } from 'imports/gi';
import { Gtk } from 'imports/gi';
import { BehaviorPreferences } from 'preferences/behaviorPreferences';

const UIFolderPath = Me.dir.get_child('ui').get_path();

function init() {}

function fillPreferencesWindow(window: Adw.PreferencesWindow) {
    const builder = new Gtk.Builder();
    const pageClasses = [BehaviorPreferences];

    builder.add_from_file(`${UIFolderPath}/preferences.ui`);

    pageClasses.forEach((pageClass) => {
        const pageObject = new pageClass(builder);
        const page = builder.get_object(pageObject.pageId) as Adw.PreferencesPage;
        window.add(page);
        pageObject.registerPreferencesPage();
    });
}
