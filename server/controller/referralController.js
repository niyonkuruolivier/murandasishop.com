import * as referralModel from "../model/referralModel.js";
import { ok, fail } from "../utils/response.js";

export async function claim(req, res) {
  try {
    const code = String(req.body.code ?? "").trim().toUpperCase();
    return ok(res, { result: await referralModel.attach(req.user.id, code) });
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function stats(req, res) {
  try {
    return ok(res, await referralModel.stats(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function list(req, res) {
  try {
    return ok(res, await referralModel.list(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}
