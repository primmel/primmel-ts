import Standard from '../types/Standard';
import { dumpMetadata } from './config/metadata';
import { dumpProcessTree } from './config/process';
import { DumperConfiguration } from './types';

/**
 * Serialize a Standard back to a .prl string.
 *
 * `root` and `meta` are emitted first because they are singletons (not
 * arrays on Standard) and conventionally appear at the top of the file.
 * Every other field is dumped by iterating its array and calling the
 * registered per-item Dumper on each element.
 *
 * Processes are special-cased: nested child processes (those with a
 * non-empty `parent` that also appear in another process's `children`)
 * are emitted inside their parent's block, not at the top level.
 */
export default function dump(
  model: Standard,
  dumpers: DumperConfiguration,
): string {
  let out = '';

  if (model.root !== null) {
    out += 'root ' + model.root.id + '\n\n';
  }

  out += dumpMetadata(model.meta) + '\n';

  const childIds = new Set<string>();
  for (const p of model.processes) {
    for (const c of p.children) {
      childIds.add(c);
    }
  }
  const processMap = new Map(model.processes.map(p => [p.id, p]));

  (Object.keys(dumpers) as Array<keyof DumperConfiguration>).forEach(field => {
    if (field === 'processes') {
      for (const p of model.processes) {
        if (!childIds.has(p.id)) {
          out += dumpProcessTree(p, processMap);
        }
      }
      return;
    }
    const items = model[field] as unknown[];
    const dumper = dumpers[field] as (item: unknown) => string;
    for (const item of items) {
      out += dumper(item);
    }
  });
  return out;
}
