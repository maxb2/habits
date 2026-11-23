import { createStore } from './store';
import { localeWeekStart } from './lib/dates';

/** The app-wide store, backed by localStorage. */
export const store = createStore(window.localStorage, localeWeekStart());
