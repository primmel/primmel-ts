// ─────────────────────────────────────────────────────────────────────
// Shared FormField parser.
//
// Both form.ts (for `form` construct) and subform.ts (for `subform`
// construct) need to parse the same `field <name> { ... }` block shape.
// Previously each file had its own copy of the same 60-line function
// (the audit called this out as a DRY violation).
//
// Extracted here so both can import without circular-dependency issues
// (this file imports only from tokenize + types, never from form/subform).
// ─────────────────────────────────────────────────────────────────────

import type { FormField } from '../../types/Form';
import { removePackage, stripWrapping, tokenizePackage } from '../tokenize';

/**
 * Parse a `field <name> { ... }` block into a FormField.
 *
 * Caller passes the field name (the token consumed before the brace)
 * and the raw block content (inside the braces). Returns a fully
 * populated FormField with all known sub-keywords processed and
 * unknown ones skipped (forward-compatible).
 */
export function parseFormField(name: string, block: string): FormField {
  const field: FormField = {
    name,
    type: 'string',
    label: '',
    definition: '',
    unit: '',
    required: false,
    measurementMethod: '',
    calculationId: null,
    calculationBindings: [],
    derivation: '',
    evaluation: null,
    values: [],
    defaultValue: '',
    hasDefault: false,
    referenceIds: [],
    fields: [],
    itemsType: '',
    subformRef: null,
  };

  if (!block || !block.trim()) return field;

  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) break;
    if (cmd === 'label') {
      field.label = removePackage(t[i++]);
    } else if (cmd === 'definition') {
      field.definition = removePackage(t[i++]);
    } else if (cmd === 'unit') {
      field.unit = removePackage(t[i++]);
    } else if (cmd === 'required') {
      field.required = removePackage(t[i++]) === 'true';
    } else if (cmd === 'measurement_method') {
      field.measurementMethod = removePackage(t[i++]);
    } else if (cmd === 'calculation') {
      // Bare ID — use stripWrapping to avoid mangling unquoted values.
      field.calculationId = stripWrapping(t[i++]);
    } else if (cmd === 'calculation_bindings') {
      // Skip the binding block (raw preservation not yet implemented).
      removePackage(t[i++]);
    } else if (cmd === 'derivation') {
      field.derivation = removePackage(t[i++]);
    } else if (cmd === 'evaluation') {
      // Skip evaluation block.
      removePackage(t[i++]);
    } else if (cmd === 'values') {
      field.values = tokenizePackage(t[i++]);
    } else if (cmd === 'default') {
      field.defaultValue = removePackage(t[i++]);
      field.hasDefault = true;
    } else if (cmd === 'min_items' || cmd === 'max_items') {
      removePackage(t[i++]);
    } else if (cmd === 'items' || cmd === 'fields') {
      removePackage(t[i++]);
    } else if (cmd === 'reference') {
      field.referenceIds = tokenizePackage(t[i++]);
    } else {
      // Forward-compatible: skip unknown keyword value
      removePackage(t[i++]);
    }
  }
  return field;
}
