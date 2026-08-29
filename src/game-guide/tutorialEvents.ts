export const FACTORY_AUTO_OPERATION_SAVED_EVENT = 'economy:factory-auto-operation-saved';

export interface FactoryAutoOperationSavedDetail {
  userId: number;
  provinceId: string;
  facilityTypeId: string;
}

export function announceFactoryAutoOperationSaved(detail: FactoryAutoOperationSavedDetail) {
  window.dispatchEvent(new CustomEvent<FactoryAutoOperationSavedDetail>(
    FACTORY_AUTO_OPERATION_SAVED_EVENT,
    { detail },
  ));
}
