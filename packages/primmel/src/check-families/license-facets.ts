// ─────────────────────────────────────────────────────────────────────
// The license-facets family (C144–C146): the manifest's licensed
// nature — one `license_key` (the entitlement catalog key the
// platform's license gate reads) and its `license_holder` (the
// copyright owner). A package without a key is public content — the
// OIML models stay license-free — so every leg keys on the key's
// presence, and a bare holder stays legal (attribution without an
// entitlement claim). The parse is permissive (the scheme_type
// precedent); the linter owns the shape. Manifest-level like C77–C85:
// runs without composing content.
//
// THE FAMILY-MODULE PATTERN (the check.ts decomposition, one family
// at a time): the family takes the context record it actually uses —
// `standard` and the two emit closures — and nothing else. The bodies
// move verbatim from check.ts; the compiler and the suite pin the
// move.
// ─────────────────────────────────────────────────────────────────────

import type Standard from '../types/Standard';
import type { CheckIssue } from '../check';

export interface LicenseFacetsContext {
  standard: Standard;
  err: (check: string, message: string) => void;
}

export function runLicenseFacetsFamily({ standard, err }: LicenseFacetsContext): void {
  const m = standard.packageManifest;
  if (m && m.licenseKey !== undefined) {
    if (!/^std:[a-z0-9-]+$/.test(m.licenseKey)) {
      err(
        'C144',
        `package "${m.id}": license_key "${m.licenseKey}" is not a catalog key — the key shape is std: followed by a lowercase kebab id, ^std:[a-z0-9-]+$ (license-key-shape)`,
      );
    }
    for (const dup of m.licenseKeyDuplicates ?? []) {
      err(
        'C145',
        `package "${m.id}": license_key declared again ("${dup}" before "${m.licenseKey}") — a package declares at most one license key; the last declaration wins (license-key-unique)`,
      );
    }
    if (!m.licenseHolder) {
      err(
        'C146',
        `package "${m.id}": license_key "${m.licenseKey}" without a license_holder — a licensed package declares its copyright owner (license-holder-required)`,
      );
    }
  }
}
