import React from 'react';
import { useAuth } from '../context/AuthContext';
import PatientLayout from './PatientLayout';
import ReviewerLayout from './ReviewerLayout';

/**
 * /cases, /cases/new, /cases/:id and /assistant are shared by patients and staff.
 * Patients get their own portal layout; staff get the Reviewer Workstation.
 * Both layouts render the matched child route through <Outlet />.
 */
const CasesShell: React.FC = () => {
  const { user } = useAuth();
  return user?.role === 'patient' ? <PatientLayout /> : <ReviewerLayout />;
};

export default CasesShell;
