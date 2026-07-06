import Standard from '../types/Standard';
import { dumpMetadata } from './config/metadata';
import { DumperConfiguration } from './types';

/**
 * Serialize a Standard back to a .mmel string.
 *
 * `root` and `meta` are emitted first because they are singletons (not
 * arrays on Standard) and conventionally appear at the top of the file.
 * Every other field is dumped by iterating its array and calling the
 * registered per-item Dumper on each element.
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

  (Object.keys(dumpers) as Array<keyof DumperConfiguration>).forEach(field => {
    const items = model[field] as unknown[];
    const dumper = dumpers[field] as (item: unknown) => string;
    for (const item of items) {
      out += dumper(item);
    }
  });
  return out;
}
