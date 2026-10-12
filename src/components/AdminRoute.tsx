import React from 'react';
import ProtectedAdminRoute from './ProtectedAdminRoute';
import AdminLayout from './AdminLayout';

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ProtectedAdminRoute>
    <AdminLayout>{children}</AdminLayout>
  </ProtectedAdminRoute>
);

export default AdminRoute;
