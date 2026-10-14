import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

interface RoleRouteProps {
  children: React.ReactNode;
  allowedRole?: string;
  allowedRoles?: string[];
}

const RoleRoute: React.FC<RoleRouteProps> = ({ children, allowedRole, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500 font-medium">Loading session...</div>;
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/auth" replace />;
  }

  const effectiveRoles = allowedRoles || (allowedRole ? [allowedRole] : []);

  if (effectiveRoles.length > 0 && !effectiveRoles.includes(user.role)) {
    // Redirect to proper destination based on role
    if (user.role === 'patient') {
      return <Navigate to="/patient/dashboard" replace />;
    }
    if (user.role === 'claims_reviewer' || user.role === 'pharmacist') {
      return <Navigate to="/review-queue" replace />;
    }
    // Legacy pharmacy and other staff roles
    return <Navigate to="/pharmacy/dashboard" replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
