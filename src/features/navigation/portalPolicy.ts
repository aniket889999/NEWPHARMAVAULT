// Navigation only. Backend authorization remains authoritative for every request.
export const STAFF_PORTALS = [
  { role: 'claims_reviewer', label: 'Claims reviewer' },
  { role: 'pharmacist', label: 'Pharmacist' },
  { role: 'org_admin', label: 'Organization administrator' },
  { role: 'super_admin', label: 'System administrator' },
  { role: 'research_evaluator', label: 'Research evaluator' },
  { role: 'payer_reviewer', label: 'Insurer claims reviewer' },
  { role: 'payer_admin', label: 'Insurer administrator' },
] as const;

export const PAYER_ROLES = ['payer_reviewer', 'payer_admin'];

export function portalHome(role?: string) {
  if (role === 'patient') return '/patient/dashboard';
  if (role === 'pharmacy') return '/pharmacy/dashboard';
  if (['pharmacist', 'claims_reviewer', 'org_admin'].includes(role || '')) return '/review-queue';
  if (role === 'super_admin') return '/admin/saas';
  if (role === 'research_evaluator') return '/research/dashboard';
  if (PAYER_ROLES.includes(role || '')) return '/payer/dashboard';
  return '/auth';
}

export function portalTitle(role: string) {
  if (role === 'patient') return 'Patient Portal';
  if (role === 'pharmacy') return 'Pharmacy Portal';
  if (role === 'research_evaluator') return 'Research Portal';
  if (PAYER_ROLES.includes(role)) return 'Insurer Portal';
  if (['org_admin', 'super_admin'].includes(role)) return 'Administrator Portal';
  return 'Reviewer Portal';
}
