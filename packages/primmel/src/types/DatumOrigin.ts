/** The datum origin axis ([[datum-unification]]): the value's epistemic
 *  provenance — where a value's authority comes from. Closed everywhere
 *  the origin facet parses (attribute_definition, symbol, and the datum
 *  blocks); the retired free-form spellings (measured, derived,
 *  test-dependent, lookup) refuse at parse. */
type DatumOrigin = 'declared' | 'design-fixed' | 'observed' | 'computed';

export default DatumOrigin;
