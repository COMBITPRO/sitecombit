// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

const env = loadEnv(process.env.NODE_ENV ?? 'development', process.cwd(), 'SITE_');
const configuredUrl = process.env.SITE_URL || env.SITE_URL || 'https://kombit.pro/';
let site;
if (configuredUrl) {
  const url = new URL(configuredUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error('SITE_URL должен содержать публичный адрес лендинга без параметров и якоря');
  }
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  site = url.href;
}

const base = process.env.SITE_BASE_PATH || env.SITE_BASE_PATH || '/';
if (!/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]*$/.test(base)) {
  throw new Error('SITE_BASE_PATH должен иметь вид / или /sitecombit/');
}

// https://astro.build/config
export default defineConfig({ site, base });
