import { readFile } from 'node:fs/promises';
import { watch }    from 'node:fs';
import { resolve }  from 'node:path';
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

// ── Cache invalidated instantly via fs.watch ──────────────────────────────────
let cache: DockboardConfig | null = null;
let watcherAttached = false;

/**
 * Attach an fs.watch listener on the config file (and its parent directory for
 * editors that do atomic writes via rename). Idempotent — only attaches once.
 * Invalidates the in-memory cache the moment any change is detected.
 */
function attachWatcher(configPath: string): void {
  if (watcherAttached) return;
  watcherAttached = true;

  // Watch the file directly for in-place writes
  try {
    const fw = watch(configPath, () => {
      console.log('[dockboard] config.yml changed — cache invalidated');
      cache = null;
    });
    fw.on('error', () => { /* file may not exist yet */ });
  } catch (_) {}

  // Also watch the parent directory for rename-based atomic writes
  // (many editors like vim/nano write a temp file then rename it)
  try {
    const dir = resolve(configPath, '..');
    const dw  = watch(dir, (_event, filename) => {
      if (filename && resolve(dir, filename) === configPath) {
        console.log('[dockboard] config.yml changed (rename) — cache invalidated');
        cache = null;
      }
    });
    dw.on('error', () => {});
  } catch (_) {}
}

export async function loadConfig(): Promise<DockboardConfig> {
  const configPath = getConfigPath();

  // Attach the file watcher once (no-op on subsequent calls)
  attachWatcher(configPath);

  if (cache) return cache;

  console.log('[dockboard] Loading config from:', configPath);
  const raw    = await readFile(configPath, 'utf-8');
  const config = yaml.load(raw) as DockboardConfig;
  console.log(`[dockboard] Config loaded OK — ${config.sections?.length ?? 0} sections`);

  cache = config;
  return config;
}
