import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, CheckCircle2, KeyRound, Plus, Search, Shield, Trash2, Users } from "lucide-react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  hasPermission,
  useAdminAccess,
  type PermissionDef,
  type PermissionKey,
} from "@/lib/admin-access";
import {
  fetchAdminUsers,
  type AdminUser,
} from "@/lib/admin-users";

const frw = (n: number) => `FRW ${Math.round(Number(n) || 0).toLocaleString()}`;

function PermissionCheckboxes({
  catalog,
  selected,
  onChange,
  disabled,
}: {
  catalog: PermissionDef[];
  selected: PermissionKey[];
  onChange: (next: PermissionKey[]) => void;
  disabled?: boolean;
}) {
  const toggle = (key: PermissionKey) => {
    if (disabled) return;
    onChange(
      selected.includes(key) ? selected.filter((p) => p !== key) : [...selected, key],
    );
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {catalog.map((item) => (
        <label
          key={item.key}
          className={`flex cursor-pointer items-start gap-3 rounded-xl border border-border p-3 transition hover:bg-secondary/50 ${
            disabled ? "cursor-not-allowed opacity-60" : ""
          }`}
        >
          <input
            type="checkbox"
            className="mt-1"
            checked={selected.includes(item.key)}
            disabled={disabled}
            onChange={() => toggle(item.key)}
          />
          <span>
            <span className="block text-sm font-semibold">{item.label}</span>
            <span className="block text-xs text-muted-foreground">{item.description}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function StaffPermissionsEditor({
  user,
  catalog,
  onSaved,
}: {
  user: AdminUser;
  catalog: PermissionDef[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<PermissionKey[]>(user.permissions);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (!selected.length) {
      alert("Select at least one permission.");
      return;
    }
    setBusy(true);
    try {
      await apiPatch(`/users/${user.id}/permissions`, { permissions: selected });
      onSaved();
      setOpen(false);
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to update permissions");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setSelected(user.permissions);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold hover:bg-secondary"
        title="Edit permissions"
      >
        <KeyRound className="h-3.5 w-3.5" /> Permissions
      </button>
    );
  }

  return (
    <div className="mt-2 rounded-xl border border-border bg-secondary/30 p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Permissions for {user.email}
      </p>
      <PermissionCheckboxes catalog={catalog} selected={selected} onChange={setSelected} />
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={save}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-accent-foreground disabled:opacity-50"
        >
          Save
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function CreateStaffForm({
  catalog,
  onCreated,
}: {
  catalog: PermissionDef[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [permissions, setPermissions] = useState<PermissionKey[]>([]);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!permissions.length) {
      alert("Select at least one permission.");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/users/staff", {
        email,
        password,
        full_name: fullName || undefined,
        phone: phone || undefined,
        permissions,
      });
      setEmail("");
      setPassword("");
      setFullName("");
      setPhone("");
      setPermissions([]);
      setOpen(false);
      onCreated();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create staff account");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground hover:opacity-90"
      >
        <Plus className="h-4 w-4" /> Create staff account
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4 rounded-2xl border border-border bg-secondary/20 p-5">
      <h3 className="inline-flex items-center gap-2 font-black">
        <Shield className="h-5 w-5" /> New staff account
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Email *</span>
          <input
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Password *</span>
          <input
            required
            minLength={6}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Full name</span>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-semibold">Phone</span>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="h-11 w-full rounded-xl border border-border bg-background px-3 outline-none focus:border-accent"
          />
        </label>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Permissions *</p>
        <PermissionCheckboxes catalog={catalog} selected={permissions} onChange={setPermissions} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-accent-foreground disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create staff"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setOpen(false)}
          className="rounded-xl border border-border px-5 py-2.5 text-sm font-semibold hover:bg-secondary"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export function UsersTab() {
  const { user: me } = useAuth();
  const { data: access } = useAdminAccess();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const canManageCustomers = hasPermission(access, "users");
  const canManageStaff = hasPermission(access, "staff");
  const catalog = access?.permissionCatalog ?? [];

  const { data: userList, isLoading, isError, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: fetchAdminUsers,
    enabled: canManageCustomers || canManageStaff,
    retry: false,
  });

  const users = Array.isArray(userList?.users) ? userList.users : [];
  const totalAccounts = userList?.total ?? users.length;
  const googleAccounts = userList?.googleTotal ?? 0;
  const listTruncated = userList?.truncated ?? false;

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        (u.full_name || "").toLowerCase().includes(term) ||
        (u.phone || "").toLowerCase().includes(term),
    );
  }, [users, q]);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  const toggleBlock = async (u: AdminUser) => {
    const next = !u.blocked;
    const label = next ? "block" : "unblock";
    if (!confirm(`${label[0].toUpperCase()}${label.slice(1)} ${u.email}?`)) return;
    setBusyId(u.id);
    try {
      await apiPatch(`/users/${u.id}/blocked`, { blocked: next });
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusyId(null);
    }
  };

  const deleteUser = async (u: AdminUser) => {
    if (
      !confirm(
        `Delete ${u.email} permanently?\n\nThis removes their profile and wallet. Orders may keep historical references.`,
      )
    ) {
      return;
    }
    setBusyId(u.id);
    try {
      await apiDelete(`/users/${u.id}`);
      refresh();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="space-y-4">
      {canManageStaff && (
        <div className="rounded-2xl border border-border bg-card p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="inline-flex items-center gap-2 text-lg font-black">
                <Shield className="h-5 w-5" /> Staff accounts
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create staff with specific dashboard permissions. They sign in with email and password.
              </p>
            </div>
            <CreateStaffForm catalog={catalog} onCreated={refresh} />
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="inline-flex items-center gap-2 text-lg font-black">
              <Users className="h-5 w-5" />{" "}
              {canManageCustomers ? "User management" : "Staff accounts"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {canManageCustomers
                ? "Block access or permanently delete accounts. You cannot block or delete yourself."
                : "View and update permissions for staff accounts."}
            </p>
          </div>
          <div className="text-right text-sm font-semibold text-muted-foreground">
            <p>
              {canManageCustomers ? (
                <>
                  {totalAccounts} total account{totalAccounts === 1 ? "" : "s"}
                  {googleAccounts > 0 && (
                    <span className="font-normal">
                      {" "}
                      · {googleAccounts} Google sign-in
                    </span>
                  )}
                </>
              ) : (
                <>
                  {totalAccounts} staff account{totalAccounts === 1 ? "" : "s"}
                </>
              )}
            </p>
            {listTruncated && !q.trim() && (
              <p className="text-xs font-normal">
                Showing latest {users.length} (use search for a specific email)
              </p>
            )}
            {q.trim() && (
              <p className="text-xs font-normal">{filtered.length} match search</p>
            )}
          </div>
        </div>

        <div className="relative mt-5 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search email, name, phone…"
            className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6">
        {isError ? (
          <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
            {error instanceof Error ? error.message : "Could not load users."}{" "}
            Sign out and sign in again if your session expired (401).
          </div>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground">Loading users…</p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No users found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2">User</th>
                  <th>Role</th>
                  {canManageStaff && <th>Permissions</th>}
                  <th>Status</th>
                  {canManageCustomers && <th>Spent</th>}
                  <th>Joined</th>
                  {canManageCustomers && <th className="w-40">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map((u) => {
                  const isMe = me?.id === u.id;
                  const busy = busyId === u.id;
                  const isStaff = u.role === "staff";
                  return (
                    <tr key={u.id} className="border-t border-border align-top">
                      <td className="py-3">
                        <div className="font-semibold">{u.full_name || "—"}</div>
                        <div className="text-muted-foreground">{u.email}</div>
                        {u.phone && <div className="text-xs text-muted-foreground">{u.phone}</div>}
                        <div className="mt-1 flex flex-wrap gap-1 text-[10px] font-semibold uppercase tracking-wide">
                          {u.google && (
                            <span className="rounded bg-sky-100 px-1.5 py-0.5 text-sky-800">Google</span>
                          )}
                          {u.has_password && (
                            <span className="rounded bg-secondary px-1.5 py-0.5 text-muted-foreground">
                              Password
                            </span>
                          )}
                          {isMe && (
                            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-accent">You</span>
                          )}
                        </div>
                      </td>
                      <td className="capitalize">{u.role}</td>
                      {canManageStaff && (
                        <td>
                          {isStaff ? (
                            <div>
                              <div className="flex flex-wrap gap-1">
                                {(u.permissions ?? []).map((p) => (
                                  <span
                                    key={p}
                                    className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-semibold uppercase"
                                  >
                                    {p}
                                  </span>
                                ))}
                              </div>
                              {!isMe && (
                                <StaffPermissionsEditor
                                  user={u}
                                  catalog={catalog}
                                  onSaved={refresh}
                                />
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      )}
                      <td>
                        {u.blocked ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                            <Ban className="h-4 w-4" /> Blocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-semibold text-success">
                            <CheckCircle2 className="h-4 w-4" /> Active
                          </span>
                        )}
                      </td>
                      {canManageCustomers && (
                        <td>
                          <div className="font-semibold">{frw(u.total_spent)}</div>
                          <div className="text-xs text-muted-foreground">
                            {u.approved_purchases} purchases
                          </div>
                        </td>
                      )}
                      <td>{new Date(u.created_at).toLocaleDateString()}</td>
                      {canManageCustomers && (
                        <td>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={busy || isMe}
                              onClick={() => toggleBlock(u)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-bold hover:bg-secondary disabled:opacity-40"
                              title={u.blocked ? "Unblock" : "Block"}
                            >
                              {u.blocked ? "Unblock" : "Block"}
                            </button>
                            <button
                              type="button"
                              disabled={busy || isMe || u.role === "admin"}
                              onClick={() => deleteUser(u)}
                              className="rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-40"
                              aria-label="Delete user"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
