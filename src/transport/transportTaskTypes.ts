export type TransportTaskKind = 'freight' | 'supply';
export type TransportTaskStatus = 'active' | 'cancelling' | 'completed' | 'cancelled' | 'expired';

export interface TransportTaskCargo {
  taskId: string;
  kind: TransportTaskKind;
  productId: string;
  quantity: number;
  sourceProvinceId: string;
  destinationProvinceId: string;
}

export interface TransportTaskView {
  id: string;
  kind: TransportTaskKind;
  status: TransportTaskStatus;
  sourceProvinceId: string;
  destinationProvinceId: string;
  productId: string;
  quantity?: number;
  targetQuantity?: number;
  deliveredQuantity: number;
  reservedQuantity: number;
  inTransitQuantity: number;
  reward?: number;
  paid?: number;
  budget?: number;
  spent: number;
  deadlineAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface TransportFreightOffer {
  id: string;
  sourceProvinceId: string;
  destinationProvinceId: string;
  productId: string;
  quantity: number;
  reward: number;
  deadlineAt: number;
}

export interface TransportTaskDispatch {
  ready: boolean;
  maintenanceRequired: boolean;
  reason: string;
  vehicleCount: number;
  fuelRequired: number;
  transportFee: number;
  transportedQuantity: number;
  fingerprint: string;
}

export interface TransportBusinessState {
  tasks: TransportTaskView[];
  offers: TransportFreightOffer[];
  dispatch: TransportTaskDispatch | null;
  reservedFuel: number;
  dailyRewardBudget: number;
  committedReward: number;
}

export type TransportTaskCommand =
  | { operation: 'task-freight-accept'; routeId: string; offerId: string }
  | { operation: 'task-supply-create'; routeId: string; sourceProvinceId: string;
      destinationProvinceId: string; productId: string; targetQuantity: number; budget: number }
  | { operation: 'task-cancel'; routeId: string; taskId: string }
  | { operation: 'task-maintain' | 'task-cycle-start'; routeId: string };
