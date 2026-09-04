import type Reference from './Reference';

/**
 * A formal term definition from a standard's terminology section.
 *
 * Terms are first-class modelling constructs: they capture the natural-language
 * definition of a concept, optionally cross-referenced to a declared `symbol`
 * (for terms that have a quantitative representation) and to the source clause
 * (e.g., R 60-1 §3.5.5 defines Emax).
 *
 * See Primmel spec MN 113-6 §2 (Term syntax).
 */
interface Term {
  id: string;
  label: string;
  definition: string;
  /** Link to a glossarist vocabulary register entry (v2 G7). */
  vocabRef?: { register: string; clause: string };
  /** Register's preferred designation when it differs from our term (v2 G7). */
  vocabTerm?: string;
  // Optional cross-reference: when a term has a quantitative form, this is
  // the id of the corresponding `symbol` declaration.
  symbolId: string;
  referenceIds: string[];
  ref: Reference[];
  /** The unified typed references (docs/primmel/18). */
  refs?: import('./Ref').Ref[];
  /** The correspondence annotations (MN 114 v3.1, clause 19.4). */
  correspondences?: import('./Correspondence').Correspondence[];
  /** Clause/section of the source document where the term is defined. */
  section?: string;
  /** Explanatory note accompanying the definition. */
  note?: string;
  /** Source URN (plain string form, e.g. "urn:oiml:pub:v:1:2022#clause-5.15"). */
  source?: string;
  /**
   * Overlay marker: this term intentionally overrides an upstream
   * package's term with the same id (composition: uses-no-redefine
   * is lifted when overlay=true). Authors set this when downstream
   * editions supersede upstream definitions (e.g. ISO/IEC 17065:2012
   * term `impartiality` overriding ISO/IEC 17000:2020's).
   */
  overlay?: boolean;
  /** Scope note qualifying the definition. */
  scopeNote?: string;
  /** Term language code (e.g. en). */
  language?: string;
  /** fullForm | abbreviation | symbol. */
  formType?: string;
  /** noun | verb | adjective | … */
  partOfSpeech?: string;
  /**
   * Alternative designations (the v2 spelling of the admitted-alternate
   * facet). The v3.2 alias family (MN 114 clause 13.10.1) names this
   * channel `aliases`; the parser folds both spellings into `aliases`
   * and this field is kept for backwards compatibility — it always
   * carries the same list.
   */
  alt?: string[];
  /**
   * Admitted alternate designations of the term (MN 114 v3.2, clause
   * 13.10.1): the canonical alias-family channel. The v2 `alt` facet
   * folds in here; the serializer emits the canonical `aliases` form.
   */
  aliases?: string[];
  /**
   * Informal, everyday phrasings that bridge retrieval to the term
   * (v3.2). NOT designations: no normative force, never rendered as the
   * term's name.
   */
  colloquial?: string[];
  /** Deprecated designations. */
  deprecated?: string[];
  /** Abbreviations of the term. */
  abbreviations?: string[];
  /**
   * Spelling-tagged alias-family variants (v3.2): ISO 24229 spelling
   * code → the family's lists authored in that spelling
   * (`colloquial fra-Latn { … }`). The bare facet forms declare the
   * package's default spelling and live on the fields above.
   */
  aliasSpellings?: Record<string, TermAliasSpelling>;
  /** Related term ids. */
  seeAlso?: string[];
}

/** The alias family of one alternate spelling (MN 114 clause 13.10.1). */
export interface TermAliasSpelling {
  aliases?: string[];
  colloquial?: string[];
  abbreviations?: string[];
  deprecated?: string[];
}

export default Term;
