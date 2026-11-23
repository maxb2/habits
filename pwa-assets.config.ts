import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config';

const fill = { resizeOptions: { background: '#0f766e', fit: 'contain' as const } };

export default defineConfig({
  preset: {
    ...minimal2023Preset,
    maskable: { ...minimal2023Preset.maskable, ...fill },
    apple: { ...minimal2023Preset.apple, ...fill },
  },
  images: ['public/favicon.svg'],
});
