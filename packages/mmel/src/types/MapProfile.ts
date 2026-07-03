import Resolvable from './Resolvable';

interface MapProfile {
  namespace: string;
  description: string;
  // Each mapping: source process id → target process id
  mappings: Record<string, string>;
}

export default MapProfile;

// Map profiles have no external relations to resolve
export type ResolvableMapProfile = Resolvable<MapProfile, never>;
