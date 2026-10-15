import type { MyOrder } from "@/lib/loyalty";

export function orderIsFinalized(order: MyOrder): boolean {
  return order.status === "completed" || Boolean(order.delivery_confirmed_at);
}

export function canConfirmDelivery(order: MyOrder): boolean {
  if (order.status === "cancelled" || orderIsFinalized(order)) return false;
  return order.delivery_status === "delivered" || order.status === "delivered";
}

export function deliveryStatusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Awaiting dispatch";
    case "processing":
      return "Processing";
    case "shipped":
      return "Out for delivery";
    case "delivered":
      return "Delivered";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

export function paymentStatusLabel(status: string): string {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Payment pending";
    case "cancelled":
      return "Cancelled";
    default:
      return status.replace(/_/g, " ");
  }
}

export function deliveryStatusBadgeClass(status: string): string {
  switch (status) {
    case "delivered":
      return "border-success text-success";
    case "shipped":
      return "border-accent text-accent";
    case "processing":
      return "border-border text-foreground";
    case "cancelled":
      return "border-destructive text-destructive";
    default:
      return "border-border text-muted-foreground";
  }
}

export function paymentStatusBadgeClass(status: string): string {
  switch (status) {
    case "paid":
      return "border-success text-success";
    case "cancelled":
      return "border-destructive text-destructive";
    default:
      return "border-border text-muted-foreground";
  }
}

export function cashbackStatusMessage(order: MyOrder): string {
  if (order.cashback_status === "credited") {
    return `Cashback earned: FRW ${Number(order.cashback_awarded).toLocaleString()}`;
  }
  if (order.cashback_status === "reversed") return "Cashback reversed";
  if (order.cashback_status === "cancelled") return "Cashback expired — not confirmed in time";
  if (order.cashback_status === "pending_delivery") {
    if (order.delivery_status === "delivered" && !order.delivery_confirmed_at) {
      return `Confirm delivery to receive FRW ${Number(order.cashback_awarded).toLocaleString()} cashback`;
    }
    return `Cashback pending — FRW ${Number(order.cashback_awarded).toLocaleString()} when you confirm delivery`;
  }
  return "No cashback on this order";
}
