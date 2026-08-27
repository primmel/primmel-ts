// ─────────────────────────────────────────────────────────────────────
// `policy` construct (MN 114 v3.1, clause 19.2; TODO.primmel/10): a
// usage-policy SET as first-class model content, in Primmel's OWN policy
// grammar — rules (permission / obligation / prohibition) over the
// dataspace's artifact classes and their actions, constraints in the
// embedded expression dialect. ODRL 2.2 is a codec OUTPUT (the
// expression layer, clause 19.5), never an import.
//
//   policy restricted-exchange {
//     name "Restricted exchange"
//     description "Restricted artifact classes exchange under an active agreement only."
//     default_posture true
//     governs { evaluation-report }
//
//     rule read-under-agreement {
//       kind permission
//       action read
//       artifact evaluation-report
//       constraint "ocl{agreement.state = #active}"
//     }
//     rule retain-nothing { kind prohibition action retain }
//     rule log-every-access { kind obligation action log }
//
//     ref derives-from "urn:example:bfs:2026#clause-6.2"
//   }
//
// FAIL-CLOSED vocabularies (the passport precedent, config/passport.ts):
//   - the rule `kind` is a closed vocabulary, parse-enforced
//     (permission | obligation | prohibition): a misspelt kind never
//     parses into a rule that says nothing;
//   - `default_posture` accepts true | false only.
// The action vocabulary is the program's register: the language carries
// it untyped, and the expression codecs map it (an ODRL projection maps
// to the ODRL action vocabulary).
//
// Round-trip: the dump emits the canonical form; the fixpoint is proven
// in test/policy.test.ts. The checker's shape rules: C107.
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
import type { ConstructDefinition } from './index';
import type Policy from '../../types/Policy';
import { POLICY_RULE_KINDS, type PolicyRule } from '../../types/Policy';

const parsePolicy: ConstructDefinition['parse'] = function (id, data) {
  const policy: Policy = {
    id,
    name: '',
    description: '',
    governs: [],
    defaultPosture: null,
    rules: [],
    source: null,
    sourceRefs: [],
  };

  forEachEntry(
    data,
    (command, value, peek) => {
      if (command === 'name') {
        policy.name = unwrapped(value);
      } else if (command === 'description') {
        policy.description = unwrapped(value);
      } else if (command === 'governs') {
        policy.governs = readEntryTokens(value());
      } else if (command === 'default_posture') {
        // Closed vocabulary, parse-enforced: true | false.
        const v = stripWrapping(value());
        if (v !== 'true' && v !== 'false') {
          throw new Error(
            `Parsing error: policy. ID ${id}: default_posture is true | false, got "${v}"`,
          );
        }
        policy.defaultPosture = v === 'true';
      } else if (command === 'rule') {
        // rule <id> { kind ... action ... [artifact ...] constraint "..." ... }
        const rule: PolicyRule = {
          id: stripWrapping(value()),
          kind: '',
          action: '',
          artifact: '',
          constraints: [],
        };
        const next = peek();
        if (next && next.startsWith('{')) {
          forEachEntry(
            unwrapBlock(value()),
            (facet, facetValue) => {
              if (facet === 'kind') {
                const k = stripWrapping(facetValue());
                if (!(POLICY_RULE_KINDS as readonly string[]).includes(k)) {
                  throw new Error(
                    `Parsing error: policy.rule. ID ${rule.id}: unknown rule kind "${k}" — rule kinds are ${POLICY_RULE_KINDS.join(' | ')} (fail-closed: a misspelt kind never parses into a rule that says nothing)`,
                  );
                }
                rule.kind = k;
              } else if (facet === 'action') {
                rule.action = stripWrapping(facetValue());
              } else if (facet === 'artifact') {
                rule.artifact = stripWrapping(facetValue());
              } else if (facet === 'constraint') {
                rule.constraints.push(unwrapped(facetValue));
              } else {
                return false;
              }
              return true;
            },
            { construct: 'policy.rule', id: rule.id },
          );
        }
        policy.rules.push(rule);
      } else if (command === 'source') {
        // Repeated provenance blocks accumulate; `source` stays first.
        const src = readSource(unwrapBlock(value()));
        policy.sourceRefs.push(src);
        if (!policy.source) {
          policy.source = src;
        }
      } else if (command === 'ref') {
        const r = parseRefFromReaders(value, peek, stripWrapping, unwrapBlock);
        if (!foldRefIntoLegacy(policy, r)) {
          (policy.refs ??= []).push(r);
        }
      } else if (command === 'corresponds') {
        (policy.correspondences ??= []).push(
          parseCorrespondsFromReaders(value, peek, stripWrapping),
        );
      } else {
        return false;
      }
      return true;
    },
    { construct: 'policy', id },
  );

  return ctx => {
    ctx.policies[id] = policy;
    return ctx;
  };
};

// ── dump (canonical form) ────────────────────────────────────────────

const dumpPolicy = function (p: Policy): string {
  let out = 'policy ' + p.id + ' {\n';
  if (p.name) {
    out += '  name "' + escapeString(p.name) + '"\n';
  }
  if (p.description) {
    out += '  description "' + escapeString(p.description) + '"\n';
  }
  if (p.defaultPosture !== null) {
    out += '  default_posture ' + (p.defaultPosture ? 'true' : 'false') + '\n';
  }
  if (p.governs.length > 0) {
    out += '  governs { ' + p.governs.map(dumpBareSafe).join(' ') + ' }\n';
  }
  for (const r of p.rules) {
    out += '  rule ' + dumpBareSafe(r.id) + ' {\n';
    if (r.kind) {
      out += '    kind ' + r.kind + '\n';
    }
    if (r.action) {
      out += '    action ' + dumpBareSafe(r.action) + '\n';
    }
    if (r.artifact) {
      out += '    artifact ' + dumpBareSafe(r.artifact) + '\n';
    }
    for (const c of r.constraints) {
      out += '    constraint "' + escapeString(c) + '"\n';
    }
    out += '  }\n';
  }
  const sources =
    p.sourceRefs && p.sourceRefs.length > 0
      ? p.sourceRefs
      : p.source
        ? [p.source]
        : [];
  for (const s of sources) {
    // The canonical provenance spelling (docs/primmel/18 §18.4).
    out += dumpSourceRefAsRef(s, '  ', escapeString);
  }
  out += dumpRefs(p.refs, '  ', escapeString);
  out += dumpCorrespondences(p.correspondences, '  ', escapeString, dumpBareSafe);
  out += '}\n';
  return out;
};

export const policyConstruct = {
  keyword: 'policy',
  field: 'policies',
  takesID: true,
  parse: parsePolicy,
  dump: dumpPolicy,
} as const;
