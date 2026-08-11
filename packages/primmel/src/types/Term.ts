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
  /** Clause/section of the source document where the term is defined. */
  section?: string;
  /** Explanatory note accompanying the definition. */
  note?: string;
  /** Source URN (plain string form, e.g. "urn:oiml:pub:v:1:2022#clause-5.15"). */
  source?: string;
  /** Scope note qualifying the definition. */
  scopeNote?: string;
  /** Term language code (e.g. en). */
  language?: string;
  /** fullForm | abbreviation | symbol. */
  formType?: string;
  /** noun | verb | adjective | … */
  partOfSpeech?: string;
  /** Alternative designations. */
  alt?: string[];
  /** Deprecated designations. */
  deprecated?: string[];
  /** Abbreviations of the term. */
  abbreviations?: string[];
  /** Related term ids. */
  seeAlso?: string[];
}

export default Term;
