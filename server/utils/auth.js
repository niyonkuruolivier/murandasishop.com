import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { query } from "./db.js";
import { canAccessAdminPanel, userHasPermission } from "./permissions.js";

const JWT_SECRET = process.env.JWT_SECRET || "murandasi-dev-secret-change-me";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "7d";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

export function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export async function optionalAuth(req, _res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      req.user = null;
      req.accessToken = null;
      return next();
    }
    const payload = verifyToken(token);
    const rows = await query(
      "SELECT id, email, blocked FROM users WHERE id = ? LIMIT 1",
      [payload.sub],
    );
    const user = rows[0] || null;
    if (user?.blocked) {
      req.user = null;
      req.accessToken = null;
      return next();
    }
    req.user = user ? { id: user.id, email: user.email } : null;
    req.accessToken = token;
    return next();
  } catch {
    req.user = null;
    req.accessToken = null;
    return next();
  }
}

export async function requireAuth(req, res, next) {
  await optionalAuth(req, res, async () => {
    if (!req.user) {
      // Distinguish blocked accounts when token is present
      try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;
        if (token) {
          const payload = verifyToken(token);
          const rows = await query(
            "SELECT blocked FROM users WHERE id = ? LIMIT 1",
            [payload.sub],
          );
          if (rows[0]?.blocked) {
            return res.status(403).json({ error: "Your account has been blocked." });
          }
        }
      } catch {
        /* ignore */
      }
      return res.status(401).json({ error: "Authentication required." });
    }
    return next();
  });
}

export async function hasRole(userId, role = "admin") {
  const rows = await query(
    "SELECT id FROM user_roles WHERE user_id = ? AND role = ? LIMIT 1",
    [userId, role],
  );
  return rows.length > 0;
}

export async function requireAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (!(await canAccessAdminPanel(req.user.id))) {
      return res.status(403).json({ error: "Admin access required." });
    }
    return next();
  });
}

export async function requireSuperAdmin(req, res, next) {
  await requireAuth(req, res, async () => {
    if (!(await hasRole(req.user.id, "admin"))) {
      return res.status(403).json({ error: "Full admin access required." });
    }
    return next();
  });
}

export function requirePermission(permission) {
  return (req, res, next) => {
    requireAuth(req, res, async () => {
      if (!(await userHasPermission(req.user.id, permission))) {
        return res.status(403).json({ error: "You do not have permission for this action." });
      }
      return next();
    });
  };
}

export function requireAnyPermission(...permissions) {
  return (req, res, next) => {
    requireAuth(req, res, async () => {
      for (const permission of permissions) {
        if (await userHasPermission(req.user.id, permission)) return next();
      }
      return res.status(403).json({ error: "You do not have permission for this action." });
    });
  };
}
