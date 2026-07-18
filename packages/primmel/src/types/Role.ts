export default interface Role {
  id: string;
  name: string;
  /** Short human label (v2 G10). */
  label?: string;
  /** Free-text description of the actor's responsibilities (v2 G10). */
  description?: string;
}
