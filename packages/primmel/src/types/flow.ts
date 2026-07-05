import Node from './Node';
import Resolvable from './Resolvable';

export interface Subprocess {
  id: string;

  // TODO: Rename to "children"
  childs: SubprocessComponent[];

  edges: Edge[];
  data: SubprocessComponent[];
}

export type ResolvableSubprocess = Subprocess & {
  _relations: {
    childs: ResolvableSubprocessComponent[];
    edges: ResolvableEdge[];
    data: ResolvableSubprocessComponent[];
  };
  /* Subprocess parsing is somewhat more complicated,
     so it keeps the equivalent of its own parse context. */
  _components: Record<string, ResolvableSubprocessComponent>;
};

export interface SubprocessComponent {
  /* The original keyword used for this component in the .mmel source.
     Distinct from `element`, which is the resolved Node reference (and
     may be null when the referenced node is not present in the model). */
  name: string;
  element: Node | null;
  x: number;
  y: number;
}

export type ResolvableSubprocessComponent = Resolvable<
  SubprocessComponent,
  'element'
>;

export interface Edge {
  id: string;
  from: SubprocessComponent | null;
  to: SubprocessComponent | null;
  description: string;
  condition: string;
}

export type ResolvableEdge = Resolvable<Edge, 'from' | 'to'>;
