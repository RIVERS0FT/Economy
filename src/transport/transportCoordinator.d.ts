export interface TransportOperation {
  key: string;
  routeId: string;
  fingerprint: string;
  run: () => Promise<{ result: { ok: boolean; message?: string } }>;
}
export function createTransportCoordinator(options: {
  getCandidates: (lastRouteId: string | null) => TransportOperation[];
  refresh: () => Promise<unknown>;
  onFailure?: (message: string) => void | Promise<void>;
}): { notify: () => void; stop: () => void; whenIdle: () => Promise<void> };
