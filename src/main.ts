import './styles.css';
import { registerSW } from 'virtual:pwa-register';
import { h, svgIcon } from './ui/dom';
import { ICONS } from './ui/icons';
import { route, startRouter } from './router';
import { store, } from './state';
import { STORAGE_KEY } from './store';
import { toast } from './ui/toast';
import type { Theme } from './types';
import { todayView } from './views/today';
import { habitsView, habitFormView } from './views/habits';
import { statsView, habitStatsView } from './views/stats';
import { settingsView } from './views/settings';
import { calendarView } from './views/calendar';

route(/^\/$/, 'today', todayView);
route(/^\/day\/(\d{4}-\d{2}-\d{2})$/, 'today', todayView);
route(/^\/habits$/, 'habits', habitsView);
route(/^\/habits\/new$/, 'habits', habitFormView);
route(/^\/habits\/([^/]+)$/, 'habits', habitFormView);
route(/^\/calendar$/, 'calendar', calendarView);
route(/^\/calendar\/(\d{4}-\d{2})$/, 'calendar', calendarView);
route(/^\/stats$/, 'stats', statsView);
route(/^\/stats\/([^/]+)$/, 'stats', habitStatsView);
route(/^\/settings$/, 'settings', settingsView);

const TABS = [
  { id: 'today', label: 'Today', href: '#/', icon: ICONS.today },
  { id: 'calendar', label: 'Calendar', href: '#/calendar', icon: ICONS.calendar },
  { id: 'stats', label: 'Stats', href: '#/stats', icon: ICONS.stats },
  { id: 'habits', label: 'Habits', href: '#/habits', icon: ICONS.habits },
  { id: 'settings', label: 'Settings', href: '#/settings', icon: ICONS.settings },
];

const tabEls = TABS.map((t) =>
  h('a', { class: 'tab', href: t.href, 'data-tab': t.id }, svgIcon(t.icon), h('span', null, t.label)),
);
document.getElementById('tabs')!.append(...tabEls);

function setTab(id: string) {
  for (const el of tabEls) {
    if (el.dataset.tab === id) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
  }
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === 'auto') delete root.dataset.theme;
  else root.dataset.theme = theme;
  const bg = getComputedStyle(root).getPropertyValue('--bg').trim();
  for (const m of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    if (theme === 'auto') m.content = m.media.includes('dark') ? '#111110' : '#f4f4f1';
    else m.content = bg;
  }
}

applyTheme(store.data.settings.theme);
let lastTheme = store.data.settings.theme;
store.subscribe((d) => {
  if (d.settings.theme !== lastTheme) {
    lastTheme = d.settings.theme;
    applyTheme(lastTheme);
  }
  if (store.saveError) toast(`Couldn't save: ${store.saveError}`, 'error');
});

const router = startRouter(document.getElementById('app')!, setTab);

// Another tab/window changed the data.
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) {
    store.reload();
    router.rerender();
  }
});

// The day may roll over while the app sits open in the background.
let day = new Date().toDateString();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && new Date().toDateString() !== day) {
    day = new Date().toDateString();
    router.rerender();
  }
});

// Ask the browser not to evict our storage (best effort; granted more readily to installed PWAs).
navigator.storage?.persist?.().catch(() => {});

registerSW({ immediate: true });
