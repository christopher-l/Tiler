const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
import { Gio } from 'imports/gi';
import { TilingType, WindowState } from 'modules/layout';

export class Settings {
    private static _instance: Settings | null;
    static init() {
        Settings._instance = new Settings();
        Settings._instance.init();
    }
    static destroy() {
        Settings._instance?.destroy();
        Settings._instance = null;
    }
    static getInstance(): Settings {
        return Settings._instance as Settings;
    }
    readonly mutterSettings = new Gio.Settings({ schema: 'org.gnome.mutter' });

    readonly dynamicWorkspaces = SettingsSubject.createBooleanSubject(
        this.mutterSettings,
        'dynamic-workspaces',
    );
    readonly appearanceSettings = ExtensionUtils.getSettings(
        `${Me.metadata['settings-schema']}.appearance`,
    );
    readonly behaviorSettings = ExtensionUtils.getSettings(
        `${Me.metadata['settings-schema']}.behavior`,
    );
    readonly shortcutsSettings = ExtensionUtils.getSettings(
        `${Me.metadata['settings-schema']}.shortcuts`,
    );

    readonly gapSize = SettingsSubject.createNumberSubject(
        this.appearanceSettings,
        'gap-size',
        'uint',
    );
    readonly defaultLayout = SettingsSubject.createStringSubject<TilingType>(
        this.behaviorSettings,
        'default-layout',
    );
    readonly defaultWindowState = SettingsSubject.createStringSubject<WindowState>(
        this.behaviorSettings,
        'default-window-state',
    );

    private init() {
        SettingsSubject.initAll();
    }

    private destroy() {
        SettingsSubject.destroyAll();
    }
}

class SettingsSubject<T> {
    private static _subjects: SettingsSubject<any>[] = [];
    static createBooleanSubject(settings: Gio.Settings, name: string): SettingsSubject<boolean> {
        return new SettingsSubject<boolean>(settings, name, {
            type: 'native',
            nativeType: 'boolean',
        });
    }
    static createNumberSubject(
        settings: Gio.Settings,
        name: string,
        numberType: 'uint',
    ): SettingsSubject<number> {
        return new SettingsSubject<number>(settings, name, {
            type: 'native',
            nativeType: numberType,
        });
    }
    static createStringSubject<T extends string = string>(
        settings: Gio.Settings,
        name: string,
    ): SettingsSubject<T> {
        return new SettingsSubject<T>(settings, name, {
            type: 'native',
            nativeType: 'string',
        });
    }
    static createStringArraySubject(
        settings: Gio.Settings,
        name: string,
    ): SettingsSubject<string[]> {
        return new SettingsSubject<string[]>(settings, name, {
            type: 'native',
            nativeType: 'strv',
        });
    }
    static createJsonObjectSubject<T>(settings: Gio.Settings, name: string): SettingsSubject<T> {
        return new SettingsSubject<T>(settings, name, { type: 'json-object' });
    }
    static initAll() {
        for (const subject of SettingsSubject._subjects) {
            subject._init();
        }
    }
    static destroyAll() {
        for (const subject of SettingsSubject._subjects) {
            subject._destroy();
        }
        SettingsSubject._subjects = [];
    }

    get value() {
        return this._value;
    }
    set value(value: T) {
        this._setValue(value);
    }

    private _value!: T;
    private _subscribers: ((value: T) => void)[] = [];
    private _getValue!: () => T;
    private _setValue!: (value: T) => void;
    private _disconnect!: () => void;

    private constructor(
        private readonly _settings: Gio.Settings,
        private readonly _name: string,
        private readonly _type:
            | { type: 'native'; nativeType: 'boolean' | 'uint' | 'string' | 'strv' }
            | { type: 'json-object' },
    ) {
        SettingsSubject._subjects.push(this);
    }

    subscribe(subscriber: (value: T) => void, { emitCurrentValue = false } = {}) {
        this._subscribers.push(subscriber);
        if (emitCurrentValue) {
            subscriber(this._value);
        }
    }

    private _init(): void {
        this._getValue = () => {
            switch (this._type.type) {
                case 'native':
                    return this._settings[`get_${this._type.nativeType}`](
                        this._name,
                    ) as unknown as T;
                case 'json-object':
                    return JSON.parse(this._settings.get_string(this._name)) as unknown as T;
                default:
                    throw new Error('unknown type ' + this._type);
            }
        };
        this._setValue = (value: T) => {
            switch (this._type.type) {
                case 'native':
                    return this._settings[`set_${this._type.nativeType}`](
                        this._name,
                        value as never,
                    );
                case 'json-object':
                    return this._settings.set_string(this._name, JSON.stringify(value));
                default:
                    throw new Error('unknown type ' + this._type);
            }
        };
        this._value = this._getValue();
        const changed = this._settings.connect(`changed::${this._name}`, () =>
            this._updateValue(this._getValue()),
        );
        this._disconnect = () => this._settings.disconnect(changed);
    }

    private _destroy(): void {
        this._disconnect();
        this._subscribers = [];
    }

    private _updateValue(value: T) {
        this._value = value;
        this._notifySubscriber();
    }

    private _notifySubscriber(): void {
        for (const subscriber of this._subscribers) {
            subscriber(this._value);
        }
    }
}
