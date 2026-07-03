import Resolvable from './Resolvable';

type LinkKind = 'REPO' | 'URL';

interface Link {
  id: string;
  kind: LinkKind;
  // For REPO: a relative or absolute path. For URL: a fully-qualified URL.
  target: string;
  namespace: string;
}

export default Link;

// Links have no external relations to resolve
export type ResolvableLink = Resolvable<Link, never>;

export { LinkKind };
