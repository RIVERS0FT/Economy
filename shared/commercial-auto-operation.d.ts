export interface CommercialAutoOperationPolicy {
  enabled: boolean;
  inputCoverageCycles: 1 | 2 | 3 | 5;
}
export const DEFAULT_COMMERCIAL_AUTO_OPERATION_POLICY: Readonly<CommercialAutoOperationPolicy>;
export function normalizeCommercialAutoOperationPolicy(value: unknown): CommercialAutoOperationPolicy | null;
export function commercialAutoOperationPolicyFor(group?: { autoOperationPolicy?: unknown } | null): Readonly<CommercialAutoOperationPolicy>;
