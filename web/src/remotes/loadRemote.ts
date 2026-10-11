import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { ComponentType } from 'react';
import type { RemoteDefinition, ShellContext } from '../../../contract/shell-contract';

export type RemoteApp = ComponentType<ShellContext>;

const loaded = new Map<string, Promise<RemoteApp>>();
const entries = new Map<string, string>();

export function registerRemoteDefinitions(defs: RemoteDefinition[]) {
  const mountable = defs.filter((d) => !d.href);
  for (const d of mountable) entries.set(d.name, d.entry);
  registerRemotes(
    mountable.map((d) => ({ name: d.name, entry: d.entry, type: 'module' as const })),
    { force: true },
  );
}

/**
 * Loads `<name>/App`. Failures are not cached. A retry re-registers the remote with a cache-busting
 * entry URL, because browsers remember a failed module fetch for the life of the page.
 */
export function loadRemoteApp(name: string, retry = false): Promise<RemoteApp> {
  const entry = entries.get(name);
  if (retry && entry) {
    loaded.delete(name);
    const sep = entry.includes('?') ? '&' : '?';
    registerRemotes([{ name, entry: `${entry}${sep}r=${Date.now()}`, type: 'module' }], { force: true });
  }
  let pending = loaded.get(name);
  if (!pending) {
    pending = loadRemote<{ default: RemoteApp }>(`${name}/App`).then((mod) => {
      if (!mod?.default) throw new Error(`Remote ${name} did not expose a default component from ./App`);
      return mod.default;
    });
    pending.catch(() => loaded.delete(name));
    loaded.set(name, pending);
  }
  return pending;
}
