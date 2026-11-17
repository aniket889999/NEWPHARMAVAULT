export function parseSessionCache(raw: string | null) {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const user = value as Record<string, unknown>;
    if (typeof user._id !== 'string' || !/^[a-f0-9]{24}$/i.test(user._id) ||
      typeof user.name !== 'string' || typeof user.email !== 'string' ||
      typeof user.role !== 'string' || typeof user.token !== 'string' || !user.token) return null;
    return { _id: user._id, name: user.name, email: user.email, role: user.role, token: user.token,
      ...(typeof user.organizationId === 'string' ? { organizationId: user.organizationId } : {}),
      ...(typeof user.branchId === 'string' ? { branchId: user.branchId } : {}) };
  } catch { return null; }
}
