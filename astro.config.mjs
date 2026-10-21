// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'SITE_');
const configuredUrl = process.env.SITE_URL || env.SITE_URL;
let site;
if (configuredUrl) {
  const url = new URL(configuredUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('SITE_URL должен содержать только адрес сайта, например https://company.ru');
  }
  site = url.origin;
}

// https://astro.build/config
export default defineConfig({ site });
