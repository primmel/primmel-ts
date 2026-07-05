import Resolvable from './Resolvable';

interface ViewProfile {
  id: string;
  description: string;
  // Stakeholder role IDs that this profile applies to
  roles: string[];
  // Element IDs visible in this profile (whitelist). Empty means "all".
  visibleElements: string[];
}

export default ViewProfile;

// View profiles have no external relations to resolve
export type ResolvableViewProfile = Resolvable<ViewProfile, never>;
