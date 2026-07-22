import Resolvable from './Resolvable';

// ─────────────────────────────────────────────────────────────────────
// View profile (v2) + the v3 mapping-space extension (TODO.roadmap/04,
// concept doc §5.6 d): a view is a READ-ONLY lens over a model — a
// filtered rendering that selects the elements visible through the lens
// plus, optionally, the reference (`against`) the model is read against.
// A view carries NO mappings of its own and never adds, removes, or
// edits the mappings of the model it reads (linter rule C26; the
// runtime projection in src/mapping-coverage.ts is frozen).
// ─────────────────────────────────────────────────────────────────────

interface ViewProfile {
  id: string;
  description: string;
  // Stakeholder role IDs that this profile applies to
  roles: string[];
  // Element IDs visible in this profile (whitelist). Empty means "all".
  visibleElements: string[];
  /**
   * The reference-model namespace this view is read against ('' = none).
   * Views reading coverage name the map_profile/mapSet namespace whose
   * coverage they filter — they never mutate it.
   */
  against: string;
}

export default ViewProfile;

// View profiles have no external relations to resolve
export type ResolvableViewProfile = Resolvable<ViewProfile, never>;
