// ─────────────────────────────────────────────────────────────────────
// Artifact constructs (Primmel v3, TODO.roadmap/09 — gap audit G2).
//
//   artifact_definition enforcement-evidence-file {
//     name "Enforcement evidence file"
//     description "Electronic record the instrument produces per enforcement measurement."
//     content_contract {
//       fields {
//         measured_speed : speed
//         ego_speed : speed optional
//         driving_direction : string
//         measurement_timestamp : datetime
//         site_parameters : structure
//         alignment_parameters : structure
//         instrument_identification : string
//         image_evidence : media optional
//       }
//       structure "one record per enforcement measurement; images embedded"
//       media {
//         image_evidence { kinds { jpeg png } role "vehicle identification" }
//       }
//     }
//     produced_when per_measurement
//     retention "approx. three months (secure storage)"
//     source { doc "urn:oiml:pub:r:91-1:2025" clause "6.6, 7.2.2, 7.3" }
//   }
//
//   artifact_instance evf-001 {
//     of enforcement-evidence-file
//     produced_at 2026-09-15T10:14:00Z
//     by smp-r91-001
//     content {
//       measured_speed : 137 km/h
//       driving_direction : "approaching"
//       measurement_timestamp : 2026-09-15T10:14:00Z
//     }
//     links { run-stationary-001 trp-r91-001 }
//   }
//
// The subject slots (task 01) reference these constructs by id:
//   is.artifacts { enforcement-evidence-file }        — definitions (IS)
//   has.artifact_instances { evf-001 }                — produced records (HAS)
//
// MECE firewall (doctrine ch. 02 §2.3/§2.4): an artifact is an output OF
// the instrument; an EvidenceRecord is a record OF the test. The linter's
// artifact-evidence-separation (C47) keeps the two vocabularies apart.
//
// produced_when shapes:
//   produced_when per_measurement            — one instance per measurement run
//   produced_when per_interval <ISO-8601>    — one instance per interval
//   produced_when on_event <event>           — one instance per event occurrence
// ─────────────────────────────────────────────────────────────────────

import tokenize from '../tokenize';
import { escapeString, stripWrapping, tokenizePackage } from '../tokenize';
import { unwrapBlock } from '../tokenize';
import { dumpBareSafe, readSource, stripColon } from './field-parser';
import {
  parseRef,
  foldRefIntoLegacy,
  dumpRefs,
  dumpSourceRefAsRef,
} from './ref';
import { skipUnknownValue } from '../parse-block';
import { dumpQuantityValue } from './quantity';
import { readValueMap } from './instance';
import type { ConstructDefinition } from './index';
import type {
  ArtifactContentContract,
  ArtifactDefinition,
  ArtifactField,
  ArtifactInstance,
  ArtifactMedia,
  ProducedWhen,
} from '../../types/Artifact';
import type { SourceRef } from '../../types/Subject';

// ── shared little readers (same shapes as subject.ts) ────────────────

function dumpSource(
  keyword: string,
  src: SourceRef | null,
  indent: string,
): string {
  if (!src || (!src.doc && !src.clause)) {
    return '';
  }
  const frag = src.fragment ? ` fragment "${escapeString(src.fragment)}"` : '';
  return `${indent}${keyword} { doc "${escapeString(src.doc)}" clause "${escapeString(src.clause)}"${frag} }\n`;
}

function readIdList(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripColon)
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

function dumpIdList(keyword: string, ids: string[], indent: string): string {
  if (ids.length === 0) {
    return '';
  }
  return `${indent}${keyword} { ${ids.join(' ')} }\n`;
}

function readReference(block: string): string[] {
  return tokenize(stripWrapping(block))
    .map(stripWrapping)
    .filter(s => s.length > 0);
}

// ── artifact_definition ──────────────────────────────────────────────

/**
 * Read `name : type [optional] ["description"]` field entries. The type is
 * one token (quantity kind, data type, 'media', 'structure', …); a missing
 * type parses as '' and is flagged by the linter (C45). A trailing quoted
 * string is the field's description.
 */
function readContractFields(block: string): ArtifactField[] {
  const out: ArtifactField[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const name = stripColon(t[i++]);
    if (!name) {
      break;
    }
    if (t[i] === ':') {
      i++;
    }
    let type = '';
    if (i < t.length && t[i] !== ':') {
      type = stripWrapping(t[i++]);
    }
    let optional = false;
    if (t[i] === 'optional') {
      optional = true;
      i++;
    }
    let description = '';
    if (i < t.length && t[i].startsWith('"')) {
      description = stripWrapping(t[i++]);
    }
    out.push({ name, type, optional, description });
  }
  return out;
}

/** Read `field { kinds { … } role "…" }` media refinement entries. */
function readContractMedia(block: string): ArtifactMedia[] {
  const out: ArtifactMedia[] = [];
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const field = stripColon(t[i++]);
    if (!field) {
      break;
    }
    const m: ArtifactMedia = { field, kinds: [], role: '' };
    if (i < t.length && t[i].startsWith('{')) {
      const inner = tokenize(unwrapBlock(t[i++]));
      let j = 0;
      while (j < inner.length) {
        const cmd = inner[j++];
        if (j >= inner.length) {
          break;
        }
        if (cmd === 'kinds') {
          m.kinds = readIdList(inner[j++]);
        } else if (cmd === 'role') {
          m.role = stripWrapping(inner[j++]);
        } else {
          unwrapBlock(inner[j++]);
        }
      }
    }
    out.push(m);
  }
  return out;
}

function parseContentContract(block: string): ArtifactContentContract {
  const contract: ArtifactContentContract = {
    fields: [],
    structure: '',
    media: [],
  };
  const t = tokenize(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'fields') {
      contract.fields = readContractFields(unwrapBlock(t[i++]));
    } else if (cmd === 'structure') {
      contract.structure = stripWrapping(t[i++]);
    } else if (cmd === 'media') {
      contract.media = readContractMedia(unwrapBlock(t[i++]));
    } else {
      i = skipUnknownValue(t, i, cmd);
    }
  }
  return contract;
}

const parseArtifactDefinition: ConstructDefinition['parse'] = function (
  id,
  data,
) {
  const result: ArtifactDefinition = {
    id,
    name: '',
    description: '',
    contentContract: { fields: [], structure: '', media: [] },
    producedWhen: { kind: '' },
    retention: '',
    source: null,
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'name') {
      result.name = stripWrapping(t[i++]);
    } else if (cmd === 'description') {
      result.description = stripWrapping(t[i++]);
    } else if (cmd === 'content_contract') {
      result.contentContract = parseContentContract(unwrapBlock(t[i++]));
    } else if (cmd === 'produced_when') {
      const kind = stripWrapping(t[i++] ?? '');
      if (kind === 'per_interval') {
        result.producedWhen = { kind, interval: stripWrapping(t[i++] ?? '') };
      } else if (kind === 'on_event') {
        result.producedWhen = { kind, event: stripWrapping(t[i++] ?? '') };
      } else {
        result.producedWhen = { kind };
      }
    } else if (cmd === 'retention') {
      result.retention = stripWrapping(t[i++]);
    } else if (cmd === 'source') {
      // Repeated provenance blocks accumulate; `source` stays first.
      const src = readSource(unwrapBlock(t[i++]));
      (result.sourceRefs ??= []).push(src);
      if (!result.source) {
        result.source = src;
      }
    } else if (cmd === 'reference') {
      result.referenceIds = readReference(t[i++]);
    } else if (cmd === 'ref') {
      // The unified typed reference (docs/primmel/18).
      const rr = parseRef(t, i, stripWrapping, unwrapBlock);
      if (!foldRefIntoLegacy(result, rr.ref)) {
        (result.refs ??= []).push(rr.ref);
      }
      i = rr.next;
    } else {
      i = skipUnknownValue(t, i, cmd);
    }
  }

  return ctx => {
    ctx.artifactDefinitions[id] = result;
    return ctx;
  };
};

function dumpProducedWhen(pw: ProducedWhen): string {
  if (pw.kind === 'per_interval') {
    return `per_interval ${dumpBareSafe(pw.interval ?? '')}`;
  }
  if (pw.kind === 'on_event') {
    return `on_event ${dumpBareSafe(pw.event ?? '')}`;
  }
  return pw.kind;
}

const dumpArtifactDefinition = function (d: ArtifactDefinition): string {
  let out = 'artifact_definition ' + d.id + ' {\n';
  if (d.name) {
    out += '  name "' + escapeString(d.name) + '"\n';
  }
  if (d.description) {
    out += '  description "' + escapeString(d.description) + '"\n';
  }
  const c = d.contentContract;
  const hasContract = c.fields.length > 0 || c.structure || c.media.length > 0;
  if (hasContract) {
    out += '  content_contract {\n';
    if (c.fields.length > 0) {
      out += '    fields {\n';
      for (const f of c.fields) {
        out +=
          '      ' +
          f.name +
          ' : ' +
          dumpBareSafe(f.type) +
          (f.optional ? ' optional' : '') +
          (f.description ? ' "' + escapeString(f.description) + '"' : '') +
          '\n';
      }
      out += '    }\n';
    }
    if (c.structure) {
      out += '    structure "' + escapeString(c.structure) + '"\n';
    }
    if (c.media.length > 0) {
      out += '    media {\n';
      for (const m of c.media) {
        let line = '      ' + m.field + ' { ';
        if (m.kinds.length > 0) {
          line += 'kinds { ' + m.kinds.join(' ') + ' } ';
        }
        if (m.role) {
          line += 'role "' + escapeString(m.role) + '" ';
        }
        out += line + '}\n';
      }
      out += '    }\n';
    }
    out += '  }\n';
  }
  if (d.producedWhen.kind) {
    out += '  produced_when ' + dumpProducedWhen(d.producedWhen) + '\n';
  }
  if (d.retention) {
    out += '  retention "' + escapeString(d.retention) + '"\n';
  }
  const artifactSources =
    d.sourceRefs && d.sourceRefs.length > 0
      ? d.sourceRefs
      : d.source
        ? [d.source]
        : [];
  for (const s of artifactSources) {
    // The canonical provenance spelling (docs/primmel/18 §18.4).
    out += dumpSourceRefAsRef(s, '  ', escapeString);
  }
  out += dumpRefs(d.refs, '  ', escapeString);
  out += dumpIdList('reference', d.referenceIds, '  ');
  out += '}\n';
  return out;
};

// ── artifact_instance ────────────────────────────────────────────────

const parseArtifactInstance: ConstructDefinition['parse'] = function (
  id,
  data,
) {
  const result: ArtifactInstance = {
    id,
    of: '',
    producedAt: '',
    by: '',
    content: {},
    links: [],
    referenceIds: [],
  };

  const t = tokenizePackage(data);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'of') {
      result.of = stripWrapping(t[i++]);
    } else if (cmd === 'produced_at') {
      result.producedAt = stripWrapping(t[i++]);
    } else if (cmd === 'by') {
      result.by = stripWrapping(t[i++]);
    } else if (cmd === 'content') {
      // Same `key : value [unit]` entry shape as instance has.attributes
      // (QuantityValue block form included) — readValueMap is shared.
      result.content = readValueMap(unwrapBlock(t[i++]));
    } else if (cmd === 'links') {
      result.links = readIdList(t[i++]);
    } else if (cmd === 'reference') {
      result.referenceIds = readReference(t[i++]);
    } else {
      i = skipUnknownValue(t, i, cmd);
    }
  }

  return ctx => {
    ctx.artifactInstances[id] = result;
    return ctx;
  };
};

const dumpArtifactInstance = function (a: ArtifactInstance): string {
  let out = 'artifact_instance ' + a.id + ' {\n';
  if (a.of) {
    out += '  of ' + a.of + '\n';
  }
  if (a.producedAt) {
    out += '  produced_at ' + dumpBareSafe(a.producedAt) + '\n';
  }
  if (a.by) {
    out += '  by ' + dumpBareSafe(a.by) + '\n';
  }
  const keys = Object.keys(a.content);
  if (keys.length > 0) {
    out +=
      '  content { ' +
      keys.map(k => k + ' : ' + dumpQuantityValue(a.content[k])).join(' ') +
      ' }\n';
  }
  out += dumpIdList('links', a.links, '  ');
  out += dumpIdList('reference', a.referenceIds, '  ');
  out += '}\n';
  return out;
};

// ── construct registry entries ───────────────────────────────────────

export const artifactDefinitionConstruct = {
  keyword: 'artifact_definition',
  field: 'artifactDefinitions',
  takesID: true,
  parse: parseArtifactDefinition,
  dump: dumpArtifactDefinition,
} as const;

export const artifactInstanceConstruct = {
  keyword: 'artifact_instance',
  field: 'artifactInstances',
  takesID: true,
  parse: parseArtifactInstance,
  dump: dumpArtifactInstance,
} as const;
