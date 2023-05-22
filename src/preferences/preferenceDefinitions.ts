import { SettingsSubject } from 'services/Settings';
import { Gio } from 'imports/gi';

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

// export const _testAssignment: Record<
//     string,
//     Record<string, PreferenceDefinition>
// > = preferenceDefinitions;

export type PreferenceDefinitions = typeof preferenceDefinitions;
export type PageName = keyof PreferenceDefinitions;
export type PageDefinition<P extends PageName> = PreferenceDefinitions[P];
export type PropertyKey<P extends PageName> = keyof PageDefinition<P>;
export type PropertyDefinition<P extends PageName, K extends PropertyKey<P>> = PageDefinition<P>[K];

function getSubject<P extends PreferenceDefinition>(propertyDefinition: P): Subject<P> {
    const settings: Gio.Settings = null as unknown as Gio.Settings;
    const id = 'foo';

    switch (propertyDefinition.widgetType) {
        case 'Adw.ComboRow':
            return SettingsSubject.createStringSubject(settings, id) as Subject<P>;
        case 'Boolean':
            return SettingsSubject.createBooleanSubject(settings, id) as Subject<P>;
    }
}

function bar<P extends PageName, K extends PropertyKey<P>>(
    p: P,
    k: K,
): Subject<PropertyDefinition<P, K>> {
    const definitions: Record<P, Record<string, PreferenceDefinition>> = preferenceDefinitions;
    return getSubject(definitions[p][k as string]) as Subject<PropertyDefinition<P, K>>;
}

const subject = bar('behavior', 'default-layout');

type Subject<P> = P extends ComboRowDefinition<infer T>
    ? SettingsSubject<T>
    : SettingsSubject<boolean>;
