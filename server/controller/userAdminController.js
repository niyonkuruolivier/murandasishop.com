import * as userAdminModel from "../model/userAdminModel.js";
import { ok, fail } from "../utils/response.js";
import { userHasPermission } from "../utils/permissions.js";
import { hasRole } from "../utils/auth.js";

const uuid = (v) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);

async function canManageStaff(userId) {
  return (await hasRole(userId, "admin")) || (await userHasPermission(userId, "staff"));
}

export async function listUsers(req, res) {
  try {
    const q = String(req.query?.q || "");
    const canManageCustomers = await userHasPermission(req.user.id, "users");
    const staffOnly = !canManageCustomers && (await userHasPermission(req.user.id, "staff"));
    return ok(res, await userAdminModel.listUsers({ q, staffOnly }));
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function permissionCatalog(_req, res) {
  try {
    return ok(res, await userAdminModel.getPermissionCatalog());
  } catch (e) {
    return fail(res, e, 500);
  }
}

export async function createStaff(req, res) {
  try {
    if (!(await canManageStaff(req.user.id))) {
      return fail(res, new Error("You do not have permission to create staff accounts."), 403);
    }
    const body = req.body ?? {};
    return ok(
      res,
      await userAdminModel.createStaffUser(
        {
          email: body.email,
          password: body.password,
          full_name: body.full_name,
          phone: body.phone,
          permissions: body.permissions,
        },
        req.user.id,
      ),
      201,
    );
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function updatePermissions(req, res) {
  try {
    if (!(await canManageStaff(req.user.id))) {
      return fail(res, new Error("You do not have permission to manage staff."), 403);
    }
    const id = uuid(req.params.id);
    if (!id) throw new Error("Invalid user id.");
    return ok(
      res,
      await userAdminModel.updateStaffPermissions(id, req.body?.permissions, req.user.id),
    );
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function setBlocked(req, res) {
  try {
    const id = uuid(req.params.id);
    if (!id) throw new Error("Invalid user id.");
    const blocked = Boolean(req.body?.blocked);
    return ok(res, await userAdminModel.setBlocked(id, blocked, req.user.id));
  } catch (e) {
    return fail(res, e, 400);
  }
}

export async function removeUser(req, res) {
  try {
    const id = uuid(req.params.id);
    if (!id) throw new Error("Invalid user id.");
    return ok(res, await userAdminModel.removeUser(id, req.user.id));
  } catch (e) {
    return fail(res, e, 400);
  }
}
