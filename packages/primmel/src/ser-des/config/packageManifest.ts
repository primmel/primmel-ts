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
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import { unwrapBlock, stripWrapping } from '../tokenize';
import type { PackageManifest, PackageSource } from '../../types/Package';
import type { Parser } from '../types';

function readList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripWrapping)
    .filter(s => s.length > 0);
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
      unwrapBlock(t[i++]);
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
