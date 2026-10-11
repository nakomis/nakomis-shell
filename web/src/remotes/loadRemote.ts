import { loadRemote, registerRemotes } from '@module-federation/runtime';
import type { ComponentType } from 'react';
import type { RemoteDefinition, ShellContext } from '../../../contract/shell-contract';

export type RemoteApp = ComponentType<ShellContext>;

const loaded = new Map<string, Promise<RemoteApp>>();

export function registerRemoteDefinitions(defs: RemoteDefinition[]) {
  registerRemotes(
    defs.filter((d) => !d.href).map((d) => ({ name: d.name, entry: d.entry, type: 'module' as const })),
    { force: true },
  );
}

/** Loads `<name>/App`. Failures are not cached, so a retry fetches again. */
export function loadRemoteApp(name: string): Promise<RemoteApp> {
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
