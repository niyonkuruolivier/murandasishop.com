import * as productModel from "../model/productModel.js";
import { ok, fail } from "../utils/response.js";

export async function list(_req, res) {
  try {
    return ok(res, await productModel.findAll());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function listAdmin(_req, res) {
  try {
    return ok(res, await productModel.findAllRaw());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function getBySlug(req, res) {
  try {
    const product = await productModel.findBySlug(req.params.slug);
    if (!product) return fail(res, "Product not found.", 404);
    return ok(res, product);
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function create(req, res) {
  try {
    return ok(res, await productModel.create(req.body), 201);
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function update(req, res) {
  try {
    return ok(res, await productModel.update(req.params.id, req.body));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function remove(req, res) {
  try {
    return ok(res, await productModel.remove(req.params.id));
  } catch (e) {
    return fail(res, e, 400);
  }
}
