/** Whether a dependency the app needs to serve requests (e.g. the database) answers. */
export interface ReadinessProbe {
  readonly name: string;
  check(): Promise<{ readonly ready: true } | { readonly ready: false; readonly reason: string }>;
}
