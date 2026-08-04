import type { FacilityStatus, FacilityStatusReason, OrderStatus } from '../types';

export const facilityStatusNames: Record<FacilityStatus, string> = {
  running: '运行',
  stopped: '停止',
  error: '异常',
};

export const facilityStatusReasonNames: Record<FacilityStatusReason, string> = {
  manual: '手动停止',
  insufficient_funds: '运营资金不足',
  insufficient_input: '生产原料不足',
  warehouse_full: '共享仓库空间不足',
  no_available_facility: '没有未冻结工厂可参与生产',
  maintenance: '系统维护',
};

export const orderStatusNames: Record<OrderStatus, string> = {
  open: '等待成交',
  partial: '部分成交',
  filled: '全部成交',
  cancelled: '已取消',
};
