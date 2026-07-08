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
  // Optional cross-reference: when a term has a quantitative form, this is
  // the id of the corresponding `symbol` declaration.
  symbolId: string;
  referenceIds: string[];
  ref: Reference[];
}

export default Term;
