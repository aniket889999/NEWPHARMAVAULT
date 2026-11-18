/** Server-validated identity only. No access token or cached role is restored. */
export function parseSessionProfile(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const user = value as Record<string, unknown>;
  if (typeof user._id !== 'string' || !/^[a-f0-9]{24}$/i.test(user._id) ||
    typeof user.name !== 'string' || typeof user.email !== 'string' || typeof user.role !== 'string') return null;
  return { _id: user._id, name: user.name, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled === true, mfaSetupRequired: user.mfaSetupRequired === true,
    ...(typeof user.organizationId === 'string' ? { organizationId: user.organizationId } : {}),
    ...(typeof user.branchId === 'string' ? { branchId: user.branchId } : {}) };
}

export function clearLegacySessionCache() {
  // Migration is removal-only. Never read or send an old local-storage token.
  try { for (const key of ['token', 'user', 'pharmavault_user']) localStorage.removeItem(key); } catch { /* Storage can be unavailable in private browsing. */ }
}

export const SESSION_EXPIRED_EVENT = 'pharmavault:session-expired';

export function notifySessionExpired() {
  clearLegacySessionCache();
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
}
