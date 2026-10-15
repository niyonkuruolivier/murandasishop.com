import * as shopSettingsModel from "../model/shopSettingsModel.js";
import { ok, fail } from "../utils/response.js";

export async function publicContact(_req, res) {
  try {
    return ok(res, await shopSettingsModel.getContactSettings());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function getShopSettings(_req, res) {
  try {
    return ok(res, await shopSettingsModel.getContactSettings());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function updateWhatsApp(req, res) {
  try {
    const phone = req.body?.whatsapp_phone ?? req.body?.phone ?? "";
    return ok(res, await shopSettingsModel.updateWhatsAppPhone(phone));
  } catch (e) {
    return fail(res, e, 400);
  }
}
