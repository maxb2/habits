import type { View } from '../router';
import { store } from '../state';
import type { Theme, WeekStart } from '../types';
import { exportJSON, parseImport } from '../lib/backup';
import { diffDays, todayKey, toKey } from '../lib/dates';
import { h } from '../ui/dom';
import { toast } from '../ui/toast';

const LAST_EXPORT_KEY = 'habit-tracker:last-export';

function segmented<T extends string | number>(
  label: string,
  options: { value: T; label: string }[],
  current: T,
  onChange: (v: T) => void,
) {
  const group = h('div', { class: 'segmented', role: 'radiogroup', 'aria-label': label });
  const render = (cur: T) =>
    group.replaceChildren(
      ...options.map((o) =>
        h(
          'button',
          {
            type: 'button',
            role: 'radio',
            'aria-checked': String(o.value === cur),
            onClick: () => {
              onChange(o.value);
              render(o.value);
            },
          },
          o.label,
        ),
      ),
    );
  render(current);
  return group;
}

function lastExportText(): string {
  const v = localStorage.getItem(LAST_EXPORT_KEY);
  if (!v) return 'You haven’t exported a backup yet.';
  const days = diffDays(v, todayKey());
  return `Last backup: ${days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`}.`;
}

async function exportBackup() {
  const json = exportJSON(store.data);
  const name = `habits-${toKey(new Date())}.json`;
  const file = new File([json], name, { type: 'application/json' });
  // On phones the share sheet ("Save to Files", Drive, etc.) is the friendliest route.
  const touch = matchMedia('(pointer: coarse)').matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Habit tracker backup' });
      markExported();
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return;
      // otherwise fall through to a download
    }
  }
  const url = URL.createObjectURL(file);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  markExported();
}

let onExported: (() => void) | null = null;
function markExported() {
  localStorage.setItem(LAST_EXPORT_KEY, todayKey());
  onExported?.();
  toast('Backup exported');
}

export const settingsView: View = (root) => {
  const { settings } = store.data;

  const lastExport = h('p', null, lastExportText());
  onExported = () => (lastExport.textContent = lastExportText());

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onChange: async () => {
      const file = fileInput.files?.[0];
      fileInput.value = '';
      if (!file) return;
      const result = parseImport(await file.text());
      if (!result.ok) {
        toast(`Import failed: ${result.error}`, 'error');
        return;
      }
      const incoming = result.data;
      const checkins = Object.values(incoming.checkins).reduce((n, d) => n + Object.keys(d).length, 0);
      const current = store.data.habits.length;
      const msg =
        `Replace your current data${current ? ` (${current} habit${current === 1 ? '' : 's'})` : ''} with this backup ` +
        `(${incoming.habits.length} habit${incoming.habits.length === 1 ? '' : 's'}, ${checkins} check-in${checkins === 1 ? '' : 's'})?`;
      if (!confirm(msg)) return;
      store.replaceAll(incoming);
      toast('Backup restored');
      root.replaceChildren();
      settingsView(root, [], { width: 0 });
    },
  });

  const persistNote = h('p', { class: 'small muted' });
  navigator.storage?.persisted?.().then((p) => {
    persistNote.textContent = p
      ? 'Storage is marked persistent, so the browser won’t clear it automatically.'
      : 'The browser may clear site data if space runs low. Installing to your home screen and exporting backups protects your history.';
  });

  root.append(
    h('header', { class: 'page-head' }, h('h1', null, 'Settings')),
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'setting' },
        h('div', { class: 'label' }, 'Week starts on'),
        segmented<WeekStart>(
          'Week starts on',
          [
            { value: 1, label: 'Monday' },
            { value: 0, label: 'Sunday' },
          ],
          settings.weekStart,
          (v) => store.updateSettings({ weekStart: v }),
        ),
      ),
      h(
        'div',
        { class: 'setting' },
        h('div', { class: 'label' }, 'Appearance'),
        segmented<Theme>(
          'Appearance',
          [
            { value: 'auto', label: 'Auto' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ],
          settings.theme,
          (v) => store.updateSettings({ theme: v }),
        ),
      ),
    ),
    h('div', { class: 'section-title' }, 'Your data'),
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'setting' },
        h('div', { class: 'label' }, 'Backup'),
        h('p', null, 'Everything is stored only on this device. Export a backup file now and then, and import it to restore or move to a new phone.'),
        lastExport,
        h(
          'div',
          { class: 'btn-row' },
          h('button', { class: 'btn primary', type: 'button', onClick: () => void exportBackup() }, 'Export backup'),
          h('button', { class: 'btn', type: 'button', onClick: () => fileInput.click() }, 'Import backup'),
        ),
        fileInput,
      ),
      h('div', { class: 'setting' }, persistNote),
    ),
    h('div', { class: 'section-title' }, 'Danger zone'),
    h(
      'div',
      { class: 'card' },
      h(
        'div',
        { class: 'setting' },
        h('p', null, 'Delete all habits and check-ins from this device.'),
        h(
          'button',
          {
            class: 'btn danger block',
            type: 'button',
            onClick: () => {
              if (!confirm('Delete ALL habits and check-ins? Export a backup first if you might want them back.')) return;
              if (!confirm('Really delete everything? This cannot be undone.')) return;
              store.clearAll();
              toast('All data cleared');
            },
          },
          'Clear all data',
        ),
      ),
    ),
    h('p', { class: 'small muted', style: 'text-align:center;margin-top:24px' }, `Habit Tracker v${__APP_VERSION__} · works offline · no account, no tracking`),
  );

  return () => {
    onExported = null;
  };
};
