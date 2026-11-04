// ─────────────────────────────────────────────────────────────────────
// The SSOT registers family (C131–C133, smart TODO.roadmap/40 batch 3,
// the packages-as-SSOT epic): the certificate print projection's shape
// fired on subject promises AND promise_set entries alike (C131), the
// applicant-facing documentation register (C132), and the evaluation
// calculation contexts' subject-chain wiring (C133). Per-register
// gating throughout (the C58 doctrine): a resolve leg runs only when
// its target register is in composition scope.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard`, the precomputed id sets it reads, the two emit closures
// — and nothing else. The bodies move verbatim from check.ts; the
// compiler and the suite pin the move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';
import type { PromiseCertificateProjection } from '../types/Subject';

export interface SsotRegistersContext {
  standard: Standard;
  attrIds: Set<string>;
  dimIds: Map<string, Set<string> | null>;
  err: (check: string, message: string) => void;
  warn: (check: string, message: string) => void;
}

export function runSsotRegistersFamily({
  standard,
  attrIds,
  dimIds,
  err,
  warn,
}: SsotRegistersContext): void {
  // ── C131: promise-certificate-projection (smart TODO.roadmap/40 ─────
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The certificate print projection's shape, fired on subject promises
  // AND promise_set entries alike: the content-binding XOR (at most one
  // of attribute / attributes / dimension; none = a statement row); the
  // bindings resolve (per-register gated, the C58 doctrine); the type is
  // the renderer's closed vocabulary (string | integer | number |
  // quantity | statement) — a check-time ERROR (the owner-settled
  // renderer contract), kept parse-total against renderer growth; the
  // label is required (the printed row carries its header). The
  // obligation vocabulary is parse-enforced upstream (no check leg).
  {
    const CERTIFICATE_TYPES = [
      'string',
      'integer',
      'number',
      'quantity',
      'statement',
    ];
    const certs: [string, PromiseCertificateProjection][] = [];
    for (const s of standard.subjects ?? []) {
      for (const p of s.is.promises ?? []) {
        if (p.certificate) {
          certs.push([`subject ${s.id}: promise "${p.id}"`, p.certificate]);
        }
      }
    }
    for (const ps of standard.promiseSets ?? []) {
      for (const p of ps.promises ?? []) {
        if (p.certificate) {
          certs.push([
            `promise_set ${ps.id}: promise "${p.id}"`,
            p.certificate,
          ]);
        }
      }
    }
    for (const [where, cert] of certs) {
      const bindings =
        (cert.attribute ? 1 : 0) +
        (cert.attributes.length > 0 ? 1 : 0) +
        (cert.dimension ? 1 : 0);
      if (bindings > 1) {
        err(
          'C131',
          `${where}: the certificate content binds by XOR — at most one of attribute / attributes / dimension (promise-certificate-projection)`,
        );
      }
      if (cert.attribute && attrIds.size > 0 && !attrIds.has(cert.attribute)) {
        err(
          'C131',
          `${where}: certificate attribute "${cert.attribute}" is not a declared attribute_definition (promise-certificate-projection)`,
        );
      }
      for (const a of cert.attributes ?? []) {
        if (attrIds.size > 0 && !attrIds.has(a)) {
          err(
            'C131',
            `${where}: certificate attributes entry "${a}" is not a declared attribute_definition (promise-certificate-projection)`,
          );
        }
      }
      if (cert.dimension && dimIds.size > 0 && !dimIds.has(cert.dimension)) {
        err(
          'C131',
          `${where}: certificate dimension "${cert.dimension}" is not a declared classification dimension (promise-certificate-projection)`,
        );
      }
      if (!cert.type) {
        err(
          'C131',
          `${where}: the certificate type is required — the renderer's row kind (promise-certificate-projection)`,
        );
      } else if (!CERTIFICATE_TYPES.includes(cert.type)) {
        err(
          'C131',
          `${where}: certificate type "${cert.type}" is outside the renderer's closed vocabulary (valid: ${CERTIFICATE_TYPES.join(', ')}) (promise-certificate-projection)`,
        );
      }
      if (!cert.label) {
        err(
          'C131',
          `${where}: the certificate label is required — the printed row carries its header (promise-certificate-projection)`,
        );
      }
    }
  }

  // ── C132: application-declaration-references (smart TODO.roadmap/40 ─
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The applicant-facing documentation register: the declaration_form
  // names a declared form WHEN the form register is in composition scope
  // (per-register gating, the C58 doctrine), and the document ids are
  // unique within the declaration. The obligation vocabulary is
  // parse-enforced upstream (no check leg).
  {
    const formIds = new Set((standard.forms ?? []).map(f => f.id));
    for (const d of standard.applicationDeclarations ?? []) {
      const where = `application_declaration ${d.id}`;
      if (
        d.declarationForm &&
        formIds.size > 0 &&
        !formIds.has(d.declarationForm)
      ) {
        err(
          'C132',
          `${where}: declaration_form "${d.declarationForm}" is not a declared form (application-declaration-references)`,
        );
      }
      const seen = new Set<string>();
      for (const doc of d.documents ?? []) {
        if (seen.has(doc.id)) {
          err(
            'C132',
            `${where}: document "${doc.id}" is declared twice (application-declaration-references)`,
          );
        }
        seen.add(doc.id);
      }
    }
  }

  // ── C133: calculation-context-references (smart TODO.roadmap/40 ─────
  // batch 3; the packages-as-SSOT epic) ────────────────────────────────
  // The evaluation-side wiring: the source is `computed` (expression
  // required) or a subject-chain source — classification.<dimension>
  // (resolves, gated) or parameters.<attribute> (resolves, gated). The
  // legacy schema tokens (dimensions, application, application.specs,
  // lookup) and anything else ERROR — the modern subject-chain spelling
  // is forced. The expression's free identifiers name the context's own
  // fields — a WARNING leg: runtime-bound inputs (r60's `f`, r144's
  // `measured_value`) are legitimate non-field references (function
  // calls exempt — an identifier followed by `(` is a callee).
  {
    for (const cc of standard.calculationContexts ?? []) {
      const fieldNames = new Set((cc.fields ?? []).map(f => f.id));
      for (const f of cc.fields ?? []) {
        const where = `calculation_context ${cc.id}: field ${f.id}`;
        if (f.source === 'computed') {
          if (!f.expression) {
            err(
              'C133',
              `${where}: source computed requires the expression facet (calculation-context-references)`,
            );
          }
        } else if (
          f.source.startsWith('classification.') ||
          f.source.startsWith('parameters.')
        ) {
          if (f.expression) {
            err(
              'C133',
              `${where}: a non-computed source carries no expression (calculation-context-references)`,
            );
          }
          if (f.source.startsWith('classification.')) {
            const dim = f.source.slice('classification.'.length);
            if (dimIds.size > 0 && !dimIds.has(dim)) {
              err(
                'C133',
                `${where}: source "${f.source}" — "${dim}" is not a declared classification dimension (calculation-context-references)`,
              );
            }
          } else {
            const attr = f.source.slice('parameters.'.length);
            if (attrIds.size > 0 && !attrIds.has(attr)) {
              err(
                'C133',
                `${where}: source "${f.source}" — "${attr}" is not a declared attribute_definition (calculation-context-references)`,
              );
            }
          }
        } else {
          err(
            'C133',
            `${where}: source "${f.source}" is not a subject-chain source (classification.<dimension>, parameters.<attribute>, computed) (calculation-context-references)`,
          );
        }
        if (f.expression) {
          const idents = new Set<string>();
          const re = /[A-Za-z_][A-Za-z0-9_]*/g;
          let m: RegExpExecArray | null;
          while ((m = re.exec(f.expression)) !== null) {
            if (!/^\s*\(/.test(f.expression.slice(re.lastIndex))) {
              idents.add(m[0]);
            }
          }
          for (const ident of idents) {
            if (!fieldNames.has(ident)) {
              warn(
                'C133',
                `${where}: expression identifier "${ident}" is not a field of this context — a runtime-bound input (declare it as a field or bind it at runtime) (calculation-context-references)`,
              );
            }
          }
        }
      }
    }
  }
}
