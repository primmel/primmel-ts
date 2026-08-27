// ─────────────────────────────────────────────────────────────────────
// `package` manifest construct (Primmel v2, gap G8) — singleton, parsed
// into ctx.packageManifest:
//
//   package {
//     id oiml-r60
//     title "OIML R 60 — Metrological regulation for load cells"
//     version "2021"
//     editions { 2021 2017 2000 }
//     baseUrn "urn:oiml:pub:r:60:2021"
//     extends oiml-core
//     description "Load cell Recommendation package"
//     source { collection "sources/r060/collection.yml" parts { 1 2 3 a } }
//   }
//
// Product reference packages (TODO.roadmap/36, doctrine ch. 15) add the
// supply-chain facets:
//
//   package {
//     id acme-lc500
//     kind product_reference
//     manufacturer "ACME Weighing GmbH"
//     product "LC-500"
//     maps_to { oiml-r60 }
//     ...
//   }
//
// and a consumer's ABSTRACT IMPORT pins the product's edition inline in
// `uses` — `uses { acme-lc500@2021 }` (the pin lands in manifest.usePins;
// C83 abstract-import-pinned).
//
// Certification program packages (TODO.v2/01, twin-certification-design
// Q4) reuse the same mapping-only shape and add the ISO/IEC 17067
// self-classification:
//
//   package {
//     id oiml-twin-cert
//     kind certification_program
//     scheme_type type_5
//     maps_to { oiml-r60 }
//     uses { acme-lc500@2021 }
//     ...
//   }
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import { skipUnknownValue } from '../parse-block';
import { escapeString, unwrapBlock, stripWrapping } from '../tokenize';
import { parseRef, foldRefIntoLegacy } from './ref';
import { dumpCorrespondences, parseCorresponds } from './correspondence';
import { dumpBareSafe } from './field-parser';
import type {
  PackageKind,
  PackageManifest,
  PackageSource,
} from '../../types/Package';
import type { Parser } from '../types';

function readList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

const PACKAGE_KINDS: readonly string[] = [
  'core',
  'module',
  'rec',
  'product_reference',
  'certification_program',
];
const EDITION_STATUSES: readonly string[] = [
  'current',
  'preview',
  'superseded',
  'withdrawn',
];

/** One URN or a `{ … }` list of them (supersedes/replaces). */
function readUrnList(token: string): string[] {
  return token.startsWith('{') ? readList(token) : [stripWrapping(token)];
}

export const parsePackage: Parser = function (data) {
  const manifest: PackageManifest = {
    id: '',
    title: '',
    version: '',
    editions: [],
    baseUrn: '',
    extends: '',
    description: '',
    source: null,
  };

  // Accepts either the block payload (`{ ... }`, from the parse loop) or a
  // whole manifest file (`package { ... }`, from loadPackage).
  let t = tokenize(data);
  if (t[0] === 'package') {
    t = t.slice(1);
  }
  if (t[0] && t[0].startsWith('{')) {
    t = tokenize(unwrapBlock(t[0]));
  }
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'id') {
      manifest.id = stripWrapping(t[i++]);
    } else if (cmd === 'title') {
      manifest.title = stripWrapping(t[i++]);
    } else if (cmd === 'version') {
      manifest.version = stripWrapping(t[i++]);
    } else if (cmd === 'editions') {
      manifest.editions = readList(t[i++]);
    } else if (cmd === 'baseUrn' || cmd === 'base_urn') {
      manifest.baseUrn = stripWrapping(t[i++]);
    } else if (cmd === 'extends') {
      manifest.extends = stripWrapping(t[i++]);
    } else if (cmd === 'uses') {
      // Entries are bare package ids, or version-pinned abstract imports
      // `<id>@<edition>` of a product reference package (TODO.roadmap/36
      // — the pin lands in usePins; C83 checks it).
      const ids: string[] = [];
      const pins: Record<string, string> = {};
      for (const entry of readList(t[i++])) {
        const at = entry.indexOf('@');
        if (at === -1) {
          ids.push(entry);
          continue;
        }
        const id = entry.slice(0, at);
        const pin = entry.slice(at + 1);
        if (!id || !pin || pin.includes('@')) {
          throw new Error(
            `Parsing error: package: malformed uses entry "${entry}" — the version-pin form is <package-id>@<edition>`,
          );
        }
        ids.push(id);
        if (!(id in pins)) {
          pins[id] = pin;
        }
      }
      manifest.uses = ids;
      if (Object.keys(pins).length > 0) {
        manifest.usePins = pins;
      }
    } else if (cmd === 'kind') {
      const k = stripWrapping(t[i++]);
      if (!PACKAGE_KINDS.includes(k)) {
        throw new Error(
          `Parsing error: package: Expected kind ${PACKAGE_KINDS.join('|')}, got "${k}"`,
        );
      }
      manifest.kind = k as PackageKind;
    } else if (cmd === 'manufacturer') {
      manifest.manufacturer = stripWrapping(t[i++]);
    } else if (cmd === 'product') {
      manifest.product = stripWrapping(t[i++]);
    } else if (cmd === 'maps_to' || cmd === 'mapsTo') {
      manifest.mapsTo = readList(t[i++]);
    } else if (cmd === 'ref') {
      // The unified typed reference (spec: docs/primmel/18).
      const r = parseRef(t, i, stripWrapping, unwrapBlock);
      if (!foldRefIntoLegacy(manifest as never, r.ref)) {
        (manifest.refs ??= []).push(r.ref);
      }
      i = r.next;
    } else if (cmd === 'corresponds') {
      // The package-level correspondence annotations (MN 114 clause 19.4).
      const cc = parseCorresponds(t, i, stripWrapping);
      (manifest.correspondences ??= []).push(cc.corr);
      i = cc.next;
    } else if (cmd === 'scheme_type' || cmd === 'schemeType') {
      // Certification program self-classification against the ISO/IEC
      // 17067 scheme-type register (TODO.v2/01) — a free token (the
      // kernel stays register-free); C98 reads it.
      manifest.schemeType = stripWrapping(t[i++]);
    } else if (cmd === 'provides') {
      manifest.provides = readList(t[i++]);
    } else if (cmd === 'requires') {
      manifest.requires = readList(t[i++]);
    } else if (cmd === 'waives') {
      manifest.waives = readList(t[i++]);
    } else if (cmd === 'supersedes') {
      manifest.supersedes = readUrnList(t[i++]);
    } else if (cmd === 'replaces') {
      manifest.replaces = readUrnList(t[i++]);
    } else if (cmd === 'validity') {
      const vblock = unwrapBlock(t[i++]);
      const vt = tokenize(vblock);
      const validity: { from: string; to?: string } = { from: '' };
      let j = 0;
      while (j < vt.length) {
        const vc = vt[j++];
        if (j >= vt.length) {
          break;
        }
        if (vc === 'from') {
          validity.from = stripWrapping(vt[j++]);
        } else if (vc === 'to') {
          validity.to = stripWrapping(vt[j++]);
        } else {
          unwrapBlock(vt[j++]);
        }
      }
      manifest.validity = validity;
    } else if (cmd === 'status') {
      const s = stripWrapping(t[i++]);
      if (!EDITION_STATUSES.includes(s)) {
        throw new Error(
          `Parsing error: package: Expected status ${EDITION_STATUSES.join('|')}, got "${s}"`,
        );
      }
      manifest.status = s as PackageManifest['status'];
    } else if (cmd === 'default_spelling' || cmd === 'defaultSpelling') {
      // ISO 24229 multilinguality (TODO.roadmap/25, doctrine ch. 10):
      // the spelling every inline prose string is authored in.
      manifest.defaultSpelling = stripWrapping(t[i++]);
    } else if (cmd === 'spellings') {
      manifest.spellings = readList(t[i++]);
    } else if (cmd === 'description') {
      manifest.description = stripWrapping(t[i++]);
    } else if (cmd === 'source') {
      const src: PackageSource = { collection: '', parts: [] };
      const sblock = unwrapBlock(t[i++]);
      const st = tokenize(sblock);
      let j = 0;
      while (j < st.length) {
        const sc = st[j++];
        if (j >= st.length) {
          break;
        }
        if (sc === 'collection') {
          src.collection = stripWrapping(st[j++]);
        } else if (sc === 'parts') {
          src.parts = readList(st[j++]);
        } else {
          unwrapBlock(st[j++]);
        }
      }
      manifest.source = src;
    } else {
      i = skipUnknownValue(t, i, cmd);
    }
  }

  return ctx => {
    ctx.packageManifest = manifest;
    return ctx;
  };
};

export function dumpPackage(m: PackageManifest): string {
  let out = 'package {\n';
  if (m.id) {
    out += '  id ' + m.id + '\n';
  }
  if (m.kind) {
    out += '  kind ' + m.kind + '\n';
  }
  if (m.manufacturer) {
    out +=
      '  manufacturer "' +
      m.manufacturer.replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
      '"\n';
  }
  if (m.product) {
    out +=
      '  product "' +
      m.product.replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
      '"\n';
  }
  if (m.mapsTo && m.mapsTo.length > 0) {
    out += '  maps_to { ' + m.mapsTo.join(' ') + ' }\n';
  }
  // The unified typed references (spec: docs/primmel/18).
  for (const r of m.refs ?? []) {
    out +=
      '  ref ' +
      r.predicate +
      ' "' +
      r.target.replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
      '"' +
      (r.note
        ? ' { note "' +
          r.note.replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
          '" }'
        : '') +
      '\n';
  }
  // The package-level correspondence annotations (MN 114 clause 19.4).
  out += dumpCorrespondences(
    m.correspondences,
    '  ',
    escapeString,
    dumpBareSafe,
  );
  if (m.schemeType) {
    out += '  scheme_type ' + m.schemeType + '\n';
  }
  if (m.title) {
    out +=
      '  title "' + m.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"\n';
  }
  if (m.version) {
    out += '  version "' + m.version + '"\n';
  }
  if (m.editions.length > 0) {
    out += '  editions { ' + m.editions.join(' ') + ' }\n';
  }
  if (m.baseUrn) {
    out += '  baseUrn "' + m.baseUrn + '"\n';
  }
  if (m.extends) {
    out += '  extends ' + m.extends + '\n';
  }
  if (m.uses && m.uses.length > 0) {
    out +=
      '  uses { ' +
      m.uses.map(u => (m.usePins?.[u] ? `${u}@${m.usePins[u]}` : u)).join(' ') +
      ' }\n';
  }
  if (m.provides && m.provides.length > 0) {
    out += '  provides { ' + m.provides.join(' ') + ' }\n';
  }
  if (m.requires && m.requires.length > 0) {
    out += '  requires { ' + m.requires.join(' ') + ' }\n';
  }
  if (m.waives && m.waives.length > 0) {
    out += '  waives { ' + m.waives.join(' ') + ' }\n';
  }
  if (m.supersedes && m.supersedes.length > 0) {
    out += '  supersedes { ' + m.supersedes.join(' ') + ' }\n';
  }
  if (m.replaces && m.replaces.length > 0) {
    out += '  replaces { ' + m.replaces.join(' ') + ' }\n';
  }
  if (m.validity && m.validity.from) {
    out +=
      '  validity { from ' +
      m.validity.from +
      (m.validity.to ? ' to ' + m.validity.to : '') +
      ' }\n';
  }
  if (m.status) {
    out += '  status ' + m.status + '\n';
  }
  if (m.defaultSpelling) {
    out += '  default_spelling ' + m.defaultSpelling + '\n';
  }
  if (m.spellings && m.spellings.length > 0) {
    out += '  spellings { ' + m.spellings.join(' ') + ' }\n';
  }
  if (m.description) {
    out +=
      '  description "' +
      m.description.replace(/\\/g, '\\\\').replace(/"/g, '\\"') +
      '"\n';
  }
  if (m.source) {
    out +=
      '  source { collection "' +
      m.source.collection +
      '" parts { ' +
      m.source.parts.join(' ') +
      ' } }\n';
  }
  out += '}\n';
  return out;
}
