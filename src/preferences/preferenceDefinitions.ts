import { SettingsSubject } from 'services/Settings';
import { Gio } from 'imports/gi';

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

interface PreferenceDefinitionBase {
    // id: string;
}

export interface ComboRowDefinition<K extends string> extends PreferenceDefinitionBase {
    widgetType: 'Adw.ComboRow';
    values: readonly K[];
}

export interface BooleanDefinition extends PreferenceDefinitionBase {
    widgetType: 'Boolean';
}

export type PreferenceDefinition = ComboRowDefinition<string> | BooleanDefinition;

// export const preferenceDefinitions: Record<string, Record<string, PreferenceDefinition>> = {
export const preferenceDefinitions = {
    behavior: {
        'default-layout': {
            // id: 'default-layout',
            widgetType: 'Adw.ComboRow',
            values: ['split-h', 'split-v', 'stacking'],
        },
        foo: {
            // id: 'foo',
            widgetType: 'Adw.ComboRow',
            values: ['foo'],
        },
    },
    appearance: {
        bar: {
            // id: 'bar',
            widgetType: 'Adw.ComboRow',
            values: ['bar'],
        },
    },
} as const;

export type PreferenceDefinitions = typeof preferenceDefinitions;
export type PageName = keyof PreferenceDefinitions;
export type PageDefinition<P extends PageName> = PreferenceDefinitions[P];
export type PropertyKey<P extends PageName> = keyof PageDefinition<P>;
export type PropertyDefinition<P extends PageName, K extends PropertyKey<P>> = PageDefinition<P>[K];

// type PageRecord<P extends PageName>

const definitions: { [pageName in PageName]: PageDefinition<pageName> } = preferenceDefinitions;

// type K = PropertyKey<'behavior'>;
// type Page = PageDefinition<'behavior'>;
// type P = PropertyDefinition<'behavior', 'default-layout'>;
// let p: P = null as unknown as P;
// p.widgetType;

// function foo<P extends PageName, K extends PropertyKey<P>>(p: P, k: K) {
//     const page = preferenceDefinitions[p];
//     const property = page[k];
//     bar(property)
//     property.widgetType;

//     preferenceDefinitions[p][k].widgetType;
// }

function foo<P extends PageName, K extends PropertyKey<P>>(p: P, k: K) {
    return preferenceDefinitions[p][k];
}

foo('behavior', 'default-layout').widgetType;

function getSubject<P extends PreferenceDefinition>(propertyDefinition: P): Subject<P> {
    const widgetType = propertyDefinition.widgetType;
    const settings: Gio.Settings = null as unknown as Gio.Settings;
    const id = 'foo';

    switch (propertyDefinition.widgetType) {
        case 'Adw.ComboRow':
            return SettingsSubject.createStringSubject(settings, id) as Subject<P>;
        case 'Boolean':
            return SettingsSubject.createBooleanSubject(settings, id) as Subject<P>;
    }
}

const s1 = getSubject(foo('behavior', 'default-layout'));

function bar<P extends PageName, K extends PropertyKey<P>>(
    p: P,
    k: K,
): Subject<PropertyDefinition<P, K>> {
    return getSubject(preferenceDefinitions[p][k] as PreferenceDefinition) as Subject<
        PropertyDefinition<P, K>
    >;
}

const subject = bar('behavior', 'default-layout');

type Subject<P> = P extends ComboRowDefinition<infer T>
    ? SettingsSubject<T>
    : SettingsSubject<boolean>;
