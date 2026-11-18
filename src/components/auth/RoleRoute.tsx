import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { portalHome } from '../../features/navigation/portalPolicy';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRole?: string;
  allowedRoles?: string[];
}

/** Security page for each portal (where MFA is set up). */
export function securityPath(role: string): string {
  if (role === 'patient') return '/patient/security';
  if (role === 'pharmacy') return '/pharmacy/security';
  if (role === 'payer_reviewer' || role === 'payer_admin') return '/payer/security';
  return '/account/security';
}

const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRole, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading session...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  // MFA_REQUIRED_FOR_STAFF: the server only answers profile/logout/MFA calls until MFA is on,
  // so the person is taken straight to the security page of their portal.
  if (user.mfaSetupRequired) {
    const target = securityPath(user.role);
    if (location.pathname !== target) return <Navigate to={target} replace />;
    return <>{children}</>;
  }

  const effectiveRoles = allowedRoles || (allowedRole ? [allowedRole] : []);

  if (effectiveRoles.length > 0 && !effectiveRoles.includes(user.role)) {
    return <Navigate to={portalHome(user.role)} replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
