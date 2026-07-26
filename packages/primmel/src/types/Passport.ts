/**
 * The `passport` construct (Primmel v3, TODO.roadmap/35 — doctrine
 * ch. 14 §14.6, ch. 15 §15.6, grammar sketch §15.8): the model-native
 * Digital Product Passport. A passport is a named, access-classed
 * PROJECTION of the product model plus its live instance state —
 * "generated from the model, served by the endpoint, verified through
 * the engine. It cannot drift from the model because it *is* the
 * model" (§14.6) — declared on a `kind product_reference` package
 * (ch. 15: the manufacturer's side of the model supply chain):
 *
 *   passport lc500_passport {
 *     upi { pattern upi:acme:lc500 level model }
 *     carrier { kind qr payload "https://passport.acme.example/passport/upi:acme:lc500.json" }
 *     public { identity composition promises_as_verified }
 *     authority { live_compliance_status }
 *   }
 *
 * The facets (TODO.roadmap/35 scope, first bullet):
 *   - CONTENT CLASSES — what the projection serves, a subset of
 *     {identity, composition, promises_as_verified,
 *     live_compliance_status, artifacts, sustainability}. An entry is a
 *     bare class (the whole class) or a qualified `<class>.<ref>` naming
 *     one aspect/promise/artifact within the class's resolution domain
 *     (the linter's C86 resolves it; §15.9: "the passport projection
 *     contains only aspects that resolve"). `sustainability` is the
 *     forward class — the ESPR delegated-act content models do not
 *     exist yet (TODO.roadmap/35, "Out"), so its refs are not
 *     kernel-resolved.
 *   - ACCESS CLASSES — who may read an entry: public | restricted |
 *     authority (the JTC24 "access rights" area; §15.6: the abstract
 *     passport is "what the EU DPP registry looks up", the authority
 *     view is "what market surveillance actually wants"). Distinct
 *     from the twin endpoint's access scopes (public | registered |
 *     authority, types/Twin.ts): endpoint scopes govern API calls,
 *     passport classes govern projection visibility. §15.9: "public
 *     classes contain nothing marked restricted" (the linter's C87).
 *   - UPI — the unique product identifier (ESPR; JTC24 "unique
 *     identifiers" area): a pattern (`upi:acme:lc500`, per-unit
 *     `upi:acme:lc500:{serial}`) and its LEVEL — model | batch | item
 *     (the ESPR unique-product-identifier levels). The sketch's
 *     `identifier upi:acme:lc500` spelling parses as the bare pattern
 *     with no level — the linter's C88 demands the level.
 *   - DATA CARRIER — the linkage (JTC24 "data carriers" area; §14.6:
 *     reachable "through a data carrier on the product"): `kind` is
 *     the carrier technology token (qr, rfid, nfc — free, OCP) and
 *     `payload` is the carrier's content: the passport endpoint URL
 *     (TODO.roadmap/35: "QR/RFID payload = the passport endpoint URL").
 *
 * The two SERVICE MODES of §15.6 are NOT a facet: abstract
 * (point-in-time, as-certified — the buyer's design-time view) and
 * live (continuous — the regulator's fleet view) are serving decisions
 * of the projection engine; the declaration already separates the live
 * content via the `live_compliance_status` class ("the same identity
 * and composition, plus live compliance status computed by the
 * engine").
 *
 * Linter rules (check.ts, family supply-chain):
 *   C86 passport-content-resolves, C87 passport-access-leak,
 *   C88 passport-upi-scheme.
 */

/**
 * The passport content classes (TODO.roadmap/35; §14.6's "identity,
 * composition, compliance and sustainability data" + §15.6's two modes).
 */
export const PASSPORT_CONTENT_CLASSES = [
  'identity',
  'composition',
  'promises_as_verified',
  'live_compliance_status',
  'artifacts',
  'sustainability',
] as const;
export type PassportContentClass = (typeof PASSPORT_CONTENT_CLASSES)[number];

/** The access classes (TODO.roadmap/35; JTC24 access rights). */
export const PASSPORT_ACCESS_CLASSES = [
  'public',
  'restricted',
  'authority',
] as const;
export type PassportAccessClass = (typeof PASSPORT_ACCESS_CLASSES)[number];

/** The ESPR unique-product-identifier levels (JTC24). */
export const PASSPORT_UPI_LEVELS = ['model', 'batch', 'item'] as const;
export type PassportUpiLevel = (typeof PASSPORT_UPI_LEVELS)[number];

/**
 * One content entry: `<class>` or `<class>.<ref>` declared under an
 * access class. Content tokens are kept raw — the parser stays total
 * and the linter (C86/C87) judges the content vocabularies. The ACCESS
 * vocabulary is fail-closed at parse time (an unknown access class is a
 * parse error), so `access` always names a declared class.
 */
export interface PassportContentEntry {
  /** The access class the entry is served under ('public' | 'restricted'
   *  | 'authority' — the parse is fail-closed on anything else). */
  access: string;
  /** The content class token as authored (C86 judges unknown classes). */
  contentClass: string;
  /** The qualified ref within the class's resolution domain ('' = the
   *  whole class; C86 resolves it against the package's declared
   *  aspects/promises). */
  ref: string;
}

/** The unique product identifier: the pattern and its ESPR level. */
export interface PassportUpi {
  /** The UPI pattern (e.g. upi:acme:lc500, upi:acme:lc500:{serial}).
   *  '' = undeclared (C88). */
  pattern: string;
  /** The ESPR level — 'model' | 'batch' | 'item'. '' = undeclared
   *  (C88: the UPI pattern declares its level). */
  level: string;
}

/** One data carrier: the on-product linkage to the passport endpoint. */
export interface PassportCarrier {
  /** The carrier technology token (qr | rfid | nfc — free, OCP). */
  kind: string;
  /** The carrier payload: the passport endpoint URL. */
  payload: string;
}

/**
 * passport <id> — the model-native DPP projection (§14.6/§15.6).
 * Top-level construct of a product reference package: the passport is
 * the product model's PUBLIC PROJECTION — declared once per served
 * passport, alongside the subject it projects, never inside the
 * anatomy (the projection speaks about the subject; it is not an
 * aspect of it).
 */
export interface Passport {
  id: string;
  /** The unique product identifier scheme (C88 judges it). */
  upi: PassportUpi;
  /** The data-carrier linkages (payload = the passport endpoint URL). */
  carriers: PassportCarrier[];
  /** The access-classed content entries (C86 resolves, C87 leak-checks). */
  entries: PassportContentEntry[];
  referenceIds: string[];
}
