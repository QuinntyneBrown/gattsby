// A session owned by one investigation. Only the adapter uses Chrome's session object.
export interface ModelSession {
  destroy(): void;
}
