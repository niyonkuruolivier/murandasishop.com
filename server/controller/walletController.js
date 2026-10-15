import * as walletModel from "../model/walletModel.js";
import * as cashbackSettingsModel from "../model/cashbackSettingsModel.js";
import { ok, fail } from "../utils/response.js";

export async function balance(req, res) {
  try {
    return ok(res, { balance: await walletModel.getBalance(req.user.id) });
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function transactions(req, res) {
  try {
    return ok(res, await walletModel.getTransactions(req.user.id));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function redeem(req, res) {
  try {
    const amount = await walletModel.redeem(req.user.id, req.body.orderId, Number(req.body.amount));
    return ok(res, { amount });
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function listWallets(_req, res) {
  try {
    return ok(res, await walletModel.listWallets());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function transactionsForUser(req, res) {
  try {
    return ok(res, await walletModel.getTransactionsForUser(req.params.userId));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function adjust(req, res) {
  try {
    return ok(
      res,
      await walletModel.adminAdjust(req.body.userId, Number(req.body.amount), req.body.note),
    );
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function reverseCashback(req, res) {
  try {
    return ok(res, await walletModel.adminReverseCashback(req.body.orderId, req.body.reason));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function cashbackPolicy(_req, res) {
  try {
    return ok(res, await cashbackSettingsModel.getSettings());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function getCashbackSettings(_req, res) {
  try {
    return ok(res, await cashbackSettingsModel.getSettings());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function updateCashbackSettings(req, res) {
  try {
    return ok(res, await cashbackSettingsModel.updateSettings(req.body ?? {}));
  } catch (e) {
    return fail(res, e, 400);
  }
}
