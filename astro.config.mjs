// @ts-check
import { defineConfig } from 'astro/config';

// Прод: https://mir-mediakit.asia (Plesk, корень домена).
// Превью на GitHub Pages: MIR_SITE=https://<логин>.github.io MIR_BASE=/<репозиторий>/ (см. .github/workflows/pages.yml)
const SITE = process.env.MIR_SITE || 'https://mir-mediakit.asia';
const BASE = process.env.MIR_BASE || '/';

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  trailingSlash: 'ignore',
  build: { inlineStylesheets: 'always', assets: '_assets' },
  image: { responsiveStyles: false },
  devToolbar: { enabled: false },
});
