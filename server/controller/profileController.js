import * as profileModel from "../model/profileModel.js";
import * as orderModel from "../model/orderModel.js";
import {
  canAccessAdminPanel,
  getEffectivePermissions,
  isSuperAdmin,
  PERMISSION_DEFS,
} from "../utils/permissions.js";
import { ok, fail } from "../utils/response.js";

export async function me(req, res) {
  try {
    return ok(res, await profileModel.findMine(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function isAdmin(req, res) {
  try {
    const userId = req.user.id;
    const permissions = await getEffectivePermissions(userId);
    const superAdmin = await isSuperAdmin(userId);
    const canAccessAdmin = await canAccessAdminPanel(userId);
    return ok(res, {
      isAdmin: canAccessAdmin,
      isSuperAdmin: superAdmin,
      permissions,
      permissionCatalog: PERMISSION_DEFS,
    });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function notifications(req, res) {
  try {
    return ok(res, await profileModel.getNotifications(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function markNotificationsRead(req, res) {
  try {
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    return ok(res, await profileModel.markNotificationsRead(ids));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function whatsapp(req, res) {
  try {
    return ok(res, await profileModel.getWhatsappPurchases(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function purchasedSlugs(req, res) {
  try {
    return ok(res, await orderModel.findPurchasedSlugs(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function listProfiles(_req, res) {
  try {
    return ok(res, await profileModel.listProfiles());
  } catch (e) {
    return fail(res, e, 500);
  }
}
