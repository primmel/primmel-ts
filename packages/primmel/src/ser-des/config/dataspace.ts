// ─────────────────────────────────────────────────────────────────────
// `dataspace` construct (MN 114 v3.1, clause 19.1; TODO.primmel/10):
// the dataspace definition as a model object — participant classes,
// artifact classes, the policy register by reference, the trust anchors,
// the clause-cited governance. Self-contained Primmel semantics; the
// dataspace-protocol alignment is the consumer's expression layer.
//
//   dataspace bfs-exchange {
//     name "Bean freshness exchange"
//     participant_class certification-body { label "..." description "..." }
//     artifact_class evaluation-report {
//       label "Evaluation report"
//       element /art/evaluation-report
//       policy restricted-exchange
//     }
//     policies { public-access restricted-exchange }
//     default_policy restricted-exchange
//     trust_anchor scheme-registry {
//       trust_ref bfs-scheme-op key bfs-2026-root
//       role registry
//     }
//     compatible_with { allied-scheme-exchange }
//     ref derives-from "urn:example:bfs:2026#clause-5.1"
//   }
//
// The sub-class blocks (participant_class, artifact_class, trust_anchor)
// are optional after their id: a bare `artifact_class x` declares the
// class with no facets (the checker's shape rules judge the content).
// The governance citations fold through the ref machinery: derives-from
// maps onto the provenance channel, every other predicate stays in refs.
//
// Round-trip: the dump emits the canonical form (facet order as below);
// the fixpoint is proven in test/dataspace.test.ts.
// ─────────────────────────────────────────────────────────────────────

import { escapeString, stripWrapping, unwrapBlock } from '../tokenize';
import { forEachEntry, unwrapped } from '../parse-block';
import { dumpBareSafe, readEntryTokens, readSource } from './field-parser';
import {
  dumpRefs,
  dumpSourceRefAsRef,
  foldRefIntoLegacy,
  parseRefFromReaders,
} from './ref';
import {
  dumpCorrespondences,
  parseCorrespondsFromReaders,
} from './correspondence';
import { dumpTrustRef, parseTrustRefFromReaders } from './trustRef';
import type { ConstructDefinition } from './index';
import type Dataspace from '../../types/Dataspace';
import type {
  DataspaceArtifactClass,
  DataspaceParticipantClass,
  DataspaceTrustAnchor,
} from '../../types/Dataspace';

const parseDataspace: ConstructDefinition['parse'] = function (id, data) {
  const ds: Dataspace = {
    id,
    name: '',
    description: '',
    participantClasses: [],
    artifactClasses: [],
    policies: [],
    defaultPolicy: '',
    trustAnchors: [],
    compatibleWith: [],
    source: null,
    sourceRefs: [],
  };

  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'name') {
        ds.name = unwrapped(value);
      } else if (command === 'description') {
        ds.description = unwrapped(value);
      } else if (command === 'participant_class') {
        // participant_class <id> [{ label ... description ... }]
        const pc: DataspaceParticipantClass = {
          id: stripWrapping(value()),
          label: '',
          description: '',
        };
        const next = peek();
        if (next && next.startsWith('{')) {
          forEachEntry(
            unwrapBlock(value()),
            (facet, facetValue) => {
              if (facet === 'label') {
                pc.label = unwrapped(facetValue);
              } else if (facet === 'description') {
                pc.description = unwrapped(facetValue);
              } else {
                return false;
              }
              return true;
            },
            { construct: 'dataspace.participant_class', id: pc.id },
          );
        }
        ds.participantClasses.push(pc);
      } else if (command === 'artifact_class') {
        // artifact_class <id> [{ label ... description ... element ... policy ... }]
        const ac: DataspaceArtifactClass = {
          id: stripWrapping(value()),
          label: '',
          description: '',
          element: '',
          policy: '',
        };
        const next = peek();
        if (next && next.startsWith('{')) {
          forEachEntry(
            unwrapBlock(value()),
            (facet, facetValue) => {
              if (facet === 'label') {
                ac.label = unwrapped(facetValue);
              } else if (facet === 'description') {
                ac.description = unwrapped(facetValue);
              } else if (facet === 'element') {
                ac.element = stripWrapping(facetValue());
              } else if (facet === 'policy') {
                ac.policy = stripWrapping(facetValue());
              } else {
                return false;
              }
              return true;
            },
            { construct: 'dataspace.artifact_class', id: ac.id },
          );
        }
        ds.artifactClasses.push(ac);
      } else if (command === 'policies') {
        ds.policies = readEntryTokens(value());
      } else if (command === 'default_policy') {
        ds.defaultPolicy = stripWrapping(value());
      } else if (command === 'trust_anchor') {
        // trust_anchor <id> [{ trust_ref <org> [key <kid>] role ... description ... }]
        const ta: DataspaceTrustAnchor = {
          id: stripWrapping(value()),
          trustRef: null,
          role: '',
          description: '',
        };
        const next = peek();
        if (next && next.startsWith('{')) {
          forEachEntry(
            unwrapBlock(value()),
            (facet, facetValue, facetPeek) => {
              if (facet === 'trust_ref') {
                ta.trustRef = parseTrustRefFromReaders(
                  facetValue,
                  facetPeek,
                  stripWrapping,
                );
              } else if (facet === 'role') {
                ta.role = stripWrapping(facetValue());
              } else if (facet === 'description') {
                ta.description = unwrapped(facetValue);
              } else {
                return false;
              }
              return true;
            },
            { construct: 'dataspace.trust_anchor', id: ta.id },
          );
        }
        ds.trustAnchors.push(ta);
      } else if (command === 'compatible_with') {
        ds.compatibleWith = readEntryTokens(value());
      } else if (command === 'source') {
        // Repeated provenance blocks accumulate; `source` stays first.
        const src = readSource(unwrapBlock(value()));
        ds.sourceRefs.push(src);
        if (!ds.source) {
          ds.source = src;
        }
      } else if (command === 'ref') {
        // The unified typed reference (docs/primmel/18): derives-from
        // folds onto the provenance channel (the governance citations).
        const r = parseRefFromReaders(value, peek, stripWrapping, unwrapBlock);
        if (!foldRefIntoLegacy(ds, r)) {
          (ds.refs ??= []).push(r);
        }
      } else if (command === 'corresponds') {
        // The per-node correspondence annotation (clause 19.4).
        (ds.correspondences ??= []).push(
          parseCorrespondsFromReaders(value, peek, stripWrapping),
        );
      } else {
        return false;
      }
      return true;
    },
    { construct: 'dataspace', id },
  );

  return ctx => {
    ctx.dataspaces[id] = ds;
    return ctx;
  };
};

// ── dump (canonical form) ────────────────────────────────────────────

const dumpDataspace = function (d: Dataspace): string {
  let out = 'dataspace ' + d.id + ' {\n';
  if (d.name) {
    out += '  name "' + escapeString(d.name) + '"\n';
  }
  if (d.description) {
    out += '  description "' + escapeString(d.description) + '"\n';
  }
  for (const pc of d.participantClasses) {
    out += '  participant_class ' + dumpBareSafe(pc.id) + ' {\n';
    if (pc.label) {
      out += '    label "' + escapeString(pc.label) + '"\n';
    }
    if (pc.description) {
      out += '    description "' + escapeString(pc.description) + '"\n';
    }
    out += '  }\n';
  }
  for (const ac of d.artifactClasses) {
    out += '  artifact_class ' + dumpBareSafe(ac.id) + ' {\n';
    if (ac.label) {
      out += '    label "' + escapeString(ac.label) + '"\n';
    }
    if (ac.description) {
      out += '    description "' + escapeString(ac.description) + '"\n';
    }
    if (ac.element) {
      out += '    element ' + dumpBareSafe(ac.element) + '\n';
    }
    if (ac.policy) {
      out += '    policy ' + dumpBareSafe(ac.policy) + '\n';
    }
    out += '  }\n';
  }
  if (d.policies.length > 0) {
    out += '  policies { ' + d.policies.map(dumpBareSafe).join(' ') + ' }\n';
  }
  if (d.defaultPolicy) {
    out += '  default_policy ' + dumpBareSafe(d.defaultPolicy) + '\n';
  }
  for (const ta of d.trustAnchors) {
    out += '  trust_anchor ' + dumpBareSafe(ta.id) + ' {\n';
    if (ta.trustRef) {
      out += dumpTrustRef(ta.trustRef, '    ', dumpBareSafe);
    }
    if (ta.role) {
      out += '    role ' + dumpBareSafe(ta.role) + '\n';
    }
    if (ta.description) {
      out += '    description "' + escapeString(ta.description) + '"\n';
    }
    out += '  }\n';
  }
  if (d.compatibleWith.length > 0) {
    out +=
      '  compatible_with { ' +
      d.compatibleWith.map(dumpBareSafe).join(' ') +
      ' }\n';
  }
  const sources =
    d.sourceRefs && d.sourceRefs.length > 0
      ? d.sourceRefs
      : d.source
        ? [d.source]
        : [];
  for (const s of sources) {
    // The canonical provenance spelling (docs/primmel/18 §18.4).
    out += dumpSourceRefAsRef(s, '  ', escapeString);
  }
  out += dumpRefs(d.refs, '  ', escapeString);
  out += dumpCorrespondences(d.correspondences, '  ', escapeString, dumpBareSafe);
  out += '}\n';
  return out;
};

export const dataspaceConstruct = {
  keyword: 'dataspace',
  field: 'dataspaces',
  takesID: true,
  parse: parseDataspace,
  dump: dumpDataspace,
} as const;
