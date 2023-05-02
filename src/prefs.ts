const Me = imports.misc.extensionUtils.getCurrentExtension();
import type { Adw } from 'imports/gi';
import { Gtk } from 'imports/gi';

const UIFolderPath = Me.dir.get_child('ui').get_path();

function init() {}

function fillPreferencesWindow(window: Adw.PreferencesWindow) {
    const builder = new Gtk.Builder();
    builder.add_from_file(`${UIFolderPath}/preferences.ui`);
    const page = builder.get_object('preferences') as Adw.PreferencesPage;
    window.add(page);
}
