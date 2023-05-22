export interface ComboRowDefinition<K extends string> {
    widgetType: 'Adw.ComboRow';
    values: readonly K[];
}

export interface BooleanDefinition {
    widgetType: 'Boolean';
}

export type PreferenceDefinition = ComboRowDefinition<string> | BooleanDefinition;

export const preferenceDefinitions = {
    behavior: {
        'default-layout': {
            widgetType: 'Adw.ComboRow',
            values: ['split-h', 'split-v', 'stacking'],
        },
        foo: {
            widgetType: 'Adw.ComboRow',
            values: ['foo'],
        },
    },
    appearance: {
        bar: {
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
