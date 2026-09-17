// ─────────────────────────────────────────────────────────────────────
// The evaluation profile (smart TODO.roadmap/40 batch 3; the
// packages-as-SSOT epic) — a NAMED dimension-value preset selecting the
// applicable requirements/tests/calculations (the applicability
// machinery is a filter; this is the named preset over it):
//
//   evaluation_profile class-a-digital-nh {
//     dimensions { accuracy_class A technology digital humidity_class NH }
//     description "Class A digital, no humidity test"
//   }
//
// A SET-cardinality dimension presets to a value LIST (r144's
// measurand_components — the extractive-co-nox preset selects several
// channels at once):
//
//   evaluation_profile extractive-co-nox-ndir-cld {
//     dimensions { measurand_components { co no } measuring_principle combined }
//     description "Extractive CEMS: NDIR for CO + chemiluminescence for NOx"
//   }
//
// The dimensions map keys on DIMENSION ids (profiles select over
// dimensions) — NOT the evaluation-dimension FIELD names (r60: profile
// key humidity_class vs field name humidity_symbol); the two namespaces
// never mix. Optional per package: r91 declares none, and no
// empty-register requirement exists.
//
// C135 evaluation-profile-coherence: every dimensions key resolves to a
// declared classification dimension and every value (each list entry)
// to one of that dimension's declared values (per-register gated; an
// OPEN dimension accepts any value) — the smart R4/R8 applicability
// mirror.
// ─────────────────────────────────────────────────────────────────────

export default interface EvaluationProfile {
  /** Kebab-case profile id (class-a-digital-nh). */
  id: string;
  /** The dimension-value preset: dimension id → value id, or value-id
   *  list for a set-cardinality dimension (r144's measurand_components),
   *  in declared order (the byte contract keys dimension ids before
   *  description). */
  dimensions: Record<string, string | string[]>;
  /** What the profile selects. */
  description: string;
}
