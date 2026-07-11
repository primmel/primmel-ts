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
import { unwrapBlock, stripWrapping, tokenizePackage } from '../tokenize';

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

  if (!block || !block.trim()) {
    return field;
  }

  const t = tokenizePackage(block);
  let i = 0;
  while (i < t.length) {
    const cmd = t[i++];
    if (i >= t.length) {
      break;
    }
    if (cmd === 'label') {
      field.label = unwrapBlock(t[i++]);
    } else if (cmd === 'definition') {
      field.definition = unwrapBlock(t[i++]);
    } else if (cmd === 'unit') {
      field.unit = unwrapBlock(t[i++]);
    } else if (cmd === 'required') {
      field.required = unwrapBlock(t[i++]) === 'true';
    } else if (cmd === 'measurement_method') {
      field.measurementMethod = unwrapBlock(t[i++]);
    } else if (cmd === 'calculation') {
      // Bare ID — use stripWrapping to avoid mangling unquoted values.
      field.calculationId = stripWrapping(t[i++]);
    } else if (cmd === 'calculation_bindings') {
      // Skip the binding block (raw preservation not yet implemented).
      unwrapBlock(t[i++]);
    } else if (cmd === 'derivation') {
      field.derivation = unwrapBlock(t[i++]);
    } else if (cmd === 'evaluation') {
      // Skip evaluation block.
      unwrapBlock(t[i++]);
    } else if (cmd === 'values') {
      field.values = tokenizePackage(t[i++]);
    } else if (cmd === 'default') {
      field.defaultValue = unwrapBlock(t[i++]);
      field.hasDefault = true;
    } else if (cmd === 'min_items' || cmd === 'max_items') {
      unwrapBlock(t[i++]);
    } else if (cmd === 'items' || cmd === 'fields') {
      unwrapBlock(t[i++]);
    } else if (cmd === 'reference') {
      field.referenceIds = tokenizePackage(t[i++]);
    } else {
      // Forward-compatible: skip unknown keyword value
      unwrapBlock(t[i++]);
    }
  }
  return field;
}
