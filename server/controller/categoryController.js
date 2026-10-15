import * as categoryModel from "../model/categoryModel.js";
import { ok, fail } from "../utils/response.js";

export async function list(_req, res) {
  try {
    return ok(res, await categoryModel.findAll());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function create(req, res) {
  try {
    return ok(res, await categoryModel.create(req.body), 201);
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function update(req, res) {
  try {
    return ok(res, await categoryModel.updateBySlug(req.params.slug, req.body));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function remove(req, res) {
  try {
    return ok(res, await categoryModel.removeBySlug(req.params.slug));
  } catch (e) {
    return fail(res, e, 400);
  }
}
