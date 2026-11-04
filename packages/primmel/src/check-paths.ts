// The bind-path + classification-alias utilities shared by the checker
// core and the family modules.

/** Identity paths (not AttributeDefinitions — fields on the entity classes). */
export const IDENTITY_PREFIXES = [
  'model.identity.',
  'model.model_designation',
  'model.hardware_revision',
  'family.family_designation',
  'manufacturer.',
  'sample.serial_number',
  'sample.sample_number',
  'sample.status',
  'sample.condition',
  'application.',
  'test_report.',
  'test_request.',
];

/** Enum-name aliases: a classification path may use the enum name while the
 *  attribute/dimension id differs (app resolves both spellings). */
export const DIM_ALIASES: Record<string, string> = {
  humidity_class: 'humidity_symbol',
};

export function isIdentityPath(path: string): boolean {
  return IDENTITY_PREFIXES.some(p => path.startsWith(p));
}
