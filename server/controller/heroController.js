import * as heroModel from "../model/heroModel.js";
import { ok, fail } from "../utils/response.js";

export async function listActive(_req, res) {
  try {
    return ok(res, await heroModel.findActive());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function listAll(_req, res) {
  try {
    return ok(res, await heroModel.findAll());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function create(req, res) {
  try {
    return ok(res, await heroModel.create(req.body), 201);
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function update(req, res) {
  try {
    return ok(res, await heroModel.update(req.params.id, req.body));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function remove(req, res) {
  try {
    return ok(res, await heroModel.remove(req.params.id));
  } catch (e) {
    return fail(res, e, 400);
  }
}
