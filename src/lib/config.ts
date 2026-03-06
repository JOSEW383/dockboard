import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import yaml from 'js-yaml';

export interface ServiceItem {
  title: string;
  description?: string;
  icon?: string;
  url: string;
}

export interface Section {
  name: string;
  items: ServiceItem[];
}

export interface DockboardConfig {
  title?: string;
  subtitle?: string;
  icon?: string;
  health_check_interval?: number;
  /** Space-separated list of domain suffixes for URL-dashboard grouping, e.g. "svjs.top mysite.com" */
  domain_groups?: string;
  sections: Section[];
}

// Resolve config path: CONFIG_PATH env var > cwd/config.yml
function getConfigPath(): string {
  if (process.env.CONFIG_PATH) return process.env.CONFIG_PATH;
  return resolve(process.cwd(), 'config.yml');
}

// Resolve icons dir: ICONS_PATH env var > cwd/icons
export function getIconsDir(): string {
  if (process.env.ICONS_PATH) return process.env.ICONS_PATH;
  return resolve(process.cwd(), 'icons');
}

// Simple in-memory cache: re-reads config at most once every 30s
let cache: { config: DockboardConfig; ts: number } | null = null;
const CACHE_TTL = 30_000;

export async function loadConfig(): Promise<DockboardConfig> {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_TTL) return cache.config;

  const configPath = getConfigPath();
  console.log('[dockboard] Loading config from:', configPath);

  const raw = await readFile(configPath, 'utf-8');
  const config = yaml.load(raw) as DockboardConfig;

  console.log(`[dockboard] Config loaded OK — ${config.sections?.length ?? 0} sections`);
  cache = { config, ts: now };
  return config;
}
