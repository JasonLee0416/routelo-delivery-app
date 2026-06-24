import {
  CalendarDeliveryItem,
  DeliveryOrder,
  RoutePlan,
} from './models';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoServiceDate(value?: string): value is string {
  if (!value || !ISO_DATE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function toCalendarDeliveryItem(
  order: DeliveryOrder,
  routePlan?: RoutePlan,
): CalendarDeliveryItem | null {
  const date = order.schedule.serviceDate;
  if (!isIsoServiceDate(date)) return null;
  const stop = routePlan?.stops.find(
    (item) => item.deliveryOrderId === order.id,
  );
  return {
    id: `calendar-${order.id}`,
    deliveryOrderId: order.id,
    date,
    startAt: order.schedule.deliveryWindow?.startAt,
    endAt: order.schedule.deliveryWindow?.endAt,
    deadlineAt: order.schedule.strictDeadlineAt,
    eventAt: order.schedule.eventAt,
    plannedArrivalAt:
      stop?.plannedArrivalAt || order.schedule.plannedArrivalAt,
    title:
      order.destination.venueName ||
      order.product.name ||
      order.destination.address ||
      '배달 일정',
    address: order.destination.address || '',
    status: order.status,
    priority: order.schedule.priority,
    timePrecision: order.schedule.timePrecision,
    routeSequence: stop?.sequence,
  };
}

export function compareCalendarItems(
  left: CalendarDeliveryItem,
  right: CalendarDeliveryItem,
) {
  const leftTime =
    left.deadlineAt ||
    left.startAt ||
    left.eventAt ||
    left.plannedArrivalAt ||
    `${left.date}T23:59:59`;
  const rightTime =
    right.deadlineAt ||
    right.startAt ||
    right.eventAt ||
    right.plannedArrivalAt ||
    `${right.date}T23:59:59`;
  return leftTime.localeCompare(rightTime);
}

