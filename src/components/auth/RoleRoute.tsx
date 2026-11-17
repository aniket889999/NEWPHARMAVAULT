import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { portalHome } from '../../features/navigation/portalPolicy';

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
    return <Navigate to={portalHome(user.role)} replace />;
  }

  return <>{children}</>;
};

export default RoleRoute;
