import Resolvable from './Resolvable';

interface Figure {
  id: string;
  title: string;
  // Base64-encoded image data, or a repo/path reference
  src: string;
}

export default Figure;

// Figures have no external relations to resolve
export type ResolvableFigure = Resolvable<Figure, never>;
