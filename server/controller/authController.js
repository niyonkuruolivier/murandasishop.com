import * as authModel from "../model/authModel.js";
import { ok, fail } from "../utils/response.js";

export async function register(req, res) {
  try {
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    const full_name = req.body.full_name ? String(req.body.full_name).trim() : null;
    if (!email || password.length < 6) throw new Error("Valid email and password (6+) required.");
    return ok(res, await authModel.register({ email, password, full_name }), 201);
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function login(req, res) {
  try {
    const email = String(req.body.email || "").trim();
    const password = String(req.body.password || "");
    if (!email || !password) throw new Error("Email and password required.");
    return ok(res, await authModel.login({ email, password }));
  } catch (e) {
    return fail(res, e, 401);
  }
}

export async function google(req, res) {
  try {
    const credential = String(req.body?.credential || "");
    if (!credential) throw new Error("Missing Google credential.");
    return ok(res, await authModel.loginWithGoogle({ credential }));
  } catch (e) {
    return fail(res, e, 401);
  }
}

export async function me(req, res) {
  try {
    return ok(res, await authModel.me(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}
