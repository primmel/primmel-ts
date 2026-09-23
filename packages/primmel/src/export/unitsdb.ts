/**
 * The UnitsDB binding (TODO.openapi/03 sibling; github oimlsmart/unitsdb):
 * the deployment points UNITSDB_DIR at a unitsdb checkout and the export
 * enriches condition-set entries with the DB's own semantics — the
 * UnitsML identifier and the measurement SCALE of the entry's unit.
 *
 * The scale is the semantic the consumer needs: a `continuous_interval`
 * unit (degree Celsius) compares by DIFFERENCES with an affine relation
 * to its SI coherent unit; a `continuous_ratio` unit (volt, V/m, the
 * percent ratio) compares by FACTOR. The numeric constants (the 273.15
 * offset) stay with the package register — the DB names the scale, the
 * register owns the number.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface UnitsDbEntry {
  /** The UnitsML identifier (u:degree_Celsius, u:volt, u:volt_per_meter). */
  unitsml: string;
  /** The NIST identifier (NISTu23). */
  nist?: string;
  /** The measurement scale (continuous_interval, continuous_ratio). */
  scale?: string;
  /** The symbols the unit is known by (ascii spellings, e.g. degC, V/m). */
  symbols: string[];
}

export interface UnitsDb {
  bySymbol: Map<string, UnitsDbEntry>;
  byUnitsml: Map<string, UnitsDbEntry>;
}

export function loadUnitsDb(dir: string | undefined): UnitsDb | null {
  if (!dir) {
    return null;
  }
  try {
    const entries: UnitsDbEntry[] = [];
    // unitsdb ships YAML; the loader reads the pre-converted JSON the
    // checkout generates (units.json), never a YAML dependency
    const jsonPath = join(dir, 'units.json');
    if (!existsSync(jsonPath)) {
      return null;
    }
    interface DbUnit {
      identifiers?: { type: string; id: string }[];
      symbols?: { ascii?: string; id?: string }[];
      scale_reference?: { id?: string };
    }
    const parsed = JSON.parse(readFileSync(jsonPath, 'utf8')).units as DbUnit[];
    if (!Array.isArray(parsed)) {
      return null;
    }
    for (const u of parsed) {
      const identifiers = (u.identifiers ?? []) as {
        type: string;
        id: string;
      }[];
      const unitsml = identifiers.find(i => i.type === 'unitsml')?.id;
      if (!unitsml) {
        continue;
      }
      const nist = identifiers.find(i => i.type === 'nist')?.id;
      const scale = u.scale_reference?.id;
      const symbols = (u.symbols ?? [])
        .map(s => String(s.ascii ?? s.id))
        .filter(Boolean);
      const entry: UnitsDbEntry = {
        unitsml,
        ...(nist ? { nist } : {}),
        ...(scale ? { scale } : {}),
        symbols,
      };
      entries.push(entry);
    }
    const bySymbol = new Map<string, UnitsDbEntry>();
    const byUnitsml = new Map<string, UnitsDbEntry>();
    // the DB writes products with negative exponents (V*m^-1); the
    // slash spelling (V/m) indexes alongside, so register symbols match
    const spellings = (s: string): string[] => [
      s,
      s.replace(/\*([a-zA-ZμΩ°]+)\^-1\b/g, '/$1'),
    ];
    for (const e of entries) {
      byUnitsml.set(e.unitsml, e);
      for (const s of e.symbols) {
        for (const sp of spellings(s)) {
          bySymbol.set(sp, e);
        }
      }
    }
    return { bySymbol, byUnitsml };
  } catch {
    return null;
  }
}

/** The DB entry for a condition-set entry's unit: matched by the
 *  register's symbol (degC, %, V/m) against the DB's ascii symbols. */
export function unitsDbEntryFor(
  db: UnitsDb | null,
  unit: string,
): UnitsDbEntry | null {
  return db?.bySymbol.get(unit) ?? null;
}
