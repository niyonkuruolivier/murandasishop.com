import * as orderModel from "../model/orderModel.js";
import { ok, fail } from "../utils/response.js";
import { confirmOrderDelivery, expirePendingCashback } from "../utils/wallet.js";

function str(v, field, max = 200) {
  const s = String(v ?? "").trim();
  if (!s) throw new Error(`${field} is required.`);
  return s.slice(0, max);
}

export async function checkout(req, res) {
  try {
    const body = req.body ?? {};
    const items = Array.isArray(body.items) ? body.items : [];
    if (items.length === 0) throw new Error("Your cart is empty.");

    const order = await orderModel.createCheckout({
      customer_name: str(body.customer_name, "Full name"),
      phone: str(body.phone, "Phone"),
      address: str(body.address, "Address", 500),
      city: str(body.city, "City"),
      country: str(body.country || "Rwanda", "Country"),
      payment_method: str(body.payment_method, "Payment method", 40),
      notes: body.notes ? String(body.notes).slice(0, 500) : null,
      userId: req.user?.id ?? null,
      walletAmount: req.user ? Math.max(0, Number(body.walletAmount) || 0) : 0,
      delivery_latitude:
        body.delivery_latitude == null || body.delivery_latitude === ""
          ? null
          : Number(body.delivery_latitude),
      delivery_longitude:
        body.delivery_longitude == null || body.delivery_longitude === ""
          ? null
          : Number(body.delivery_longitude),
      delivery_location_label: body.delivery_location_label
        ? String(body.delivery_location_label).slice(0, 255)
        : null,
      items: items.slice(0, 100).map((i) => ({
        slug: String(i.slug),
        qty: Math.max(1, Math.min(100, Math.floor(Number(i.qty) || 1))),
        variations:
          i.variations && typeof i.variations === "object" && !Array.isArray(i.variations)
            ? i.variations
            : undefined,
      })),
    });
    return ok(res, order, 201);
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function mine(req, res) {
  try {
    // Don't block the response — expiry runs on a server timer too.
    void expirePendingCashback().catch((error) =>
      console.error("[Cashback] expiry check failed", error),
    );
    return ok(res, await orderModel.findMine(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function confirmDelivery(req, res) {
  try {
    return ok(res, await confirmOrderDelivery(req.user.id, req.params.id));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function listAll(_req, res) {
  try {
    return ok(res, await orderModel.findAll());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function pendingCount(_req, res) {
  try {
    return ok(res, { count: await orderModel.countPending() });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function updateStatus(req, res) {
  try {
    const { status, payment_status, delivery_status, shipping_attachment_url } = req.body ?? {};
    if (payment_status !== undefined || delivery_status !== undefined) {
      return ok(
        res,
        await orderModel.updateStatuses(req.params.id, {
          payment_status,
          delivery_status,
          shipping_attachment_url,
        }),
      );
    }
    return ok(res, await orderModel.updateStatus(req.params.id, status));
  } catch (e) {
    return fail(res, e, 400);
  }
}
