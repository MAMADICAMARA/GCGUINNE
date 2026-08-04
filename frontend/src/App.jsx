import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import AuthLayout from '@/layouts/AuthLayout';
import AccountLayout from '@/layouts/AccountLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import AdminLayout from '@/layouts/AdminLayout';
import ProtectedRoute from '@/routes/ProtectedRoute';
import RequireStoreRoute from '@/routes/RequireStoreRoute';
import RequireSuperAdminRoute from '@/routes/RequireSuperAdminRoute';

import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';

import AccountHomePage from '@/pages/account/AccountHomePage';
import MyStorePage from '@/pages/account/MyStorePage';
import SupervisePage from '@/pages/account/SupervisePage';
import SupervisedStoreDetailPage from '@/pages/account/SupervisedStoreDetailPage';
import ProfilePage from '@/pages/account/ProfilePage';
import AccountSettingsPage from '@/pages/account/AccountSettingsPage';

import DashboardPage from '@/pages/dashboard/DashboardPage';
import PosPage from '@/pages/pos/PosPage';
import ProductsPage from '@/pages/products/ProductsPage';
import StockPage from '@/pages/stock/StockPage';
import SalesHistoryPage from '@/pages/sales/SalesHistoryPage';
import CustomersPage from '@/pages/customers/CustomersPage';
import SuppliersPage from '@/pages/suppliers/SuppliersPage';
import SupplierStorefrontPage from '@/pages/suppliers/SupplierStorefrontPage';
import PurchasesPage from '@/pages/purchases/PurchasesPage';
import NotesPage from '@/pages/notes/NotesPage';
import EmployeesPage from '@/pages/employees/EmployeesPage';
import AuditLogPage from '@/pages/audit-log/AuditLogPage';
import SettingsPage from '@/pages/settings/SettingsPage';

import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminStoresPage from '@/pages/admin/AdminStoresPage';
import AdminUsersPage from '@/pages/admin/AdminUsersPage';
import AdminAuditLogPage from '@/pages/admin/AdminAuditLogPage';
import AdminPlansPage from '@/pages/admin/AdminPlansPage';
import AdminPaymentRequestsPage from '@/pages/admin/AdminPaymentRequestsPage';
import AdminStoreTypesPage from '@/pages/admin/AdminStoreTypesPage';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Authentification */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Espace COMPTE — nécessite une session, PAS de boutique active.
            C'est ici que l'utilisateur atterrit après connexion/inscription. */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AccountLayout />}>
            <Route path="/account" element={<AccountHomePage />} />
            <Route path="/account/store" element={<MyStorePage />} />
            <Route path="/account/supervise" element={<SupervisePage />} />
            <Route path="/account/supervise/:storeId" element={<SupervisedStoreDetailPage />} />
            <Route path="/account/profile" element={<ProfilePage />} />
            <Route path="/account/settings" element={<AccountSettingsPage />} />
          </Route>
        </Route>

        {/* Espace BOUTIQUE — nécessite une boutique active. Atteint depuis
            "Ma Boutique" en cliquant sur "Ouvrir" ou juste après création. */}
        <Route element={<RequireStoreRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/stock" element={<StockPage />} />
            <Route path="/sales" element={<SalesHistoryPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/suppliers" element={<SuppliersPage />} />
            <Route path="/suppliers/:storeId/order" element={<SupplierStorefrontPage />} />
            <Route path="/purchases" element={<PurchasesPage />} />
            <Route path="/notes" element={<NotesPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/audit-log" element={<AuditLogPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Route>

        {/* Espace SUPER ADMIN — plateforme entière, tous clients confondus
            (§3.1 du cahier des charges). N'exige PAS de boutique active. */}
        <Route element={<RequireSuperAdminRoute />}>
          <Route element={<AdminLayout />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/stores" element={<AdminStoresPage />} />
            <Route path="/admin/users" element={<AdminUsersPage />} />
            <Route path="/admin/audit-log" element={<AdminAuditLogPage />} />
            <Route path="/admin/plans" element={<AdminPlansPage />} />
            <Route path="/admin/payment-requests" element={<AdminPaymentRequestsPage />} />
            <Route path="/admin/store-types" element={<AdminStoreTypesPage />} />
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/account" replace />} />
        <Route path="*" element={<Navigate to="/account" replace />} />
      </Routes>
    </BrowserRouter>
  );
}