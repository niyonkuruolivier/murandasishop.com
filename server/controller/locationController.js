import * as locationModel from "../model/locationModel.js";
import { ok, fail } from "../utils/response.js";

function required(value, name, max = 255) {
  const text = String(value ?? "").trim();
  if (!text) throw new Error(`${name} is required.`);
  return text.slice(0, max);
}

function coordinate(value, name) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${name} is invalid.`);
  return number;
}

function input(body = {}) {
  return {
    label: required(body.label || "Delivery location", "Label", 80),
    address: required(body.address, "Address", 500),
    city: required(body.city, "City", 120),
    country: required(body.country || "Rwanda", "Country", 120),
    latitude: coordinate(body.latitude, "Latitude"),
    longitude: coordinate(body.longitude, "Longitude"),
    is_default: Boolean(body.is_default),
  };
}

export async function list(req, res) {
  try {
    return ok(res, await locationModel.list(req.user.id));
  } catch (error) {
    return fail(res, error, 500);
  }
}

export async function create(req, res) {
  try {
    return ok(res, await locationModel.create(req.user.id, input(req.body)), 201);
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function remove(req, res) {
  try {
    return ok(res, await locationModel.remove(req.user.id, req.params.id));
  } catch (error) {
    return fail(res, error, 400);
  }
}

export async function makeDefault(req, res) {
  try {
    return ok(res, await locationModel.makeDefault(req.user.id, req.params.id));
  } catch (error) {
    return fail(res, error, 400);
  }
}
