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
  // Containment: the requirements a class declares as members dump
  // nested inside it, never standalone.
  const memberIds = new Set<string>();
  for (const rc of model.requirementClasses ?? []) {
    for (const m of rc.members ?? []) {
      memberIds.add(m);
    }
  }
  const requirementMap = new Map(
    (model.requirements ?? []).map(r => [r.id, r]),
  );
  const classMap = new Map(
    (model.requirementClasses ?? []).map(rc => [rc.id, rc]),
  );
  const dumpersRef = dumpers as unknown as Record<
    string,
    (item: unknown) => string
  >;
  const dumpClassTree = (rcId: string): string => {
    const rc = classMap.get(rcId);
    if (!rc) {
      return '';
    }
    const base = dumpersRef.requirementClasses(rc);
    if (!rc.members || rc.members.length === 0) {
      return base;
    }
    const inner = rc.members
      .map(m => {
        const body = dumpersRef.requirements(requirementMap.get(m));
        return body
          .split('\n')
          .filter(l => l !== '')
          .map(l => '  ' + l)
          .join('\n');
      })
      .join('\n');
    return base.slice(0, base.lastIndexOf('}')) + inner + '\n}\n';
  };

  (Object.keys(dumpers) as Array<keyof DumperConfiguration>).forEach(field => {
    if (field === 'processes') {
      for (const p of model.processes) {
        if (!childIds.has(p.id)) {
          out += dumpProcessTree(p, processMap);
        }
      }
      return;
    }
    if (field === 'requirements') {
      for (const r of model.requirements ?? []) {
        if (!memberIds.has(r.id)) {
          out += dumpersRef.requirements(r);
        }
      }
      return;
    }
    if (field === 'requirementClasses') {
      for (const rc of model.requirementClasses ?? []) {
        out += dumpClassTree(rc.id);
      }
      return;
    }
    if (field === 'checks') {
      // C161 (TODO.lang-gaps/03): a check folded from a retired boolean
      // spelling is the parse-side view of its owner — the serializer
      // emits the canonical form only, so a fold never serializes and
      // dump(load(x)) stays byte-identical for documents spelling the
      // verdict the retired way.
      for (const c of model.checks ?? []) {
        if (!c.folds) {
          out += dumpersRef.checks(c);
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
