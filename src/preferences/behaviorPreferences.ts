const Me = imports.misc.extensionUtils.getCurrentExtension();
import { Gtk } from 'imports/gi';
import { TilingType } from 'modules/layout';
const ExtensionUtils = imports.misc.extensionUtils;
import { Settings } from 'services/Settings';

export class BehaviorPreferences {
    readonly pageId = 'behavior';
    readonly keys = [
        {
            id: 'default-layout',
            widgetType: 'Adw.ComboRow',
            values: ['split-h', 'split-v', 'stacking'],
        },
    ];

    private readonly _settings = ExtensionUtils.getSettings(
        `${Me.metadata['settings-schema']}.${this.pageId}`,
    );

    constructor(private _builder: Gtk.Builder) {}

    registerPreferencesPage() {
        Settings.init();
        const settings = Settings.getInstance();
        this.keys.forEach((key) => {
            switch (key.widgetType) {
                case 'Adw.ComboRow':
                    this._builder.get_object(key.id)!.connect('notify::selected-item', (w) => {
                        const index = w.get_selected();
                        const value = key.values[index] as TilingType;
                        // this._settings.set_string(key.id, value);
                        settings.defaultLayout.value = value;
                        console.log('selected-item foo', key.id, value);
                    });
                    break;
            }
        });
    }
}
