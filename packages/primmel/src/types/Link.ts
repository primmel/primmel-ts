import Resolvable from './Resolvable';

export type LinkKind = 'REPO' | 'URL';

interface Link {
  id: string;
  kind: LinkKind;
  target: string;
  namespace: string;
}

export default Link;

export type ResolvableLink = Resolvable<Link, never>;
