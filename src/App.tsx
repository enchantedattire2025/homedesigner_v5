import React, { useEffect, useState, lazy, Suspense } from 'react';

import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useLocation
} from 'react-router-dom';

import { AuthProvider } from './hooks/AuthContext';
import { useAuth } from './hooks/useAuth';
import { useDesignerProfile } from './hooks/useDesignerProfile';
import { detectUserTypeAndRedirect } from './utils/userTypeDetection';
import { processUserNotifications } from './utils/whatsappNotification';

import Header from './components/Header';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import InstallPrompt from './components/InstallPrompt';
import ProtectedDesignerRoute from './components/ProtectedDesignerRoute';
import SubscriptionExpiredModal from './components/SubscriptionExpiredModal';

import Home from './pages/Home';

import { forceLogoutAll } from './utils/clearAuth';
import { debugAuthState } from './utils/debugDesigner';
import { useSubscription } from './hooks/useSubscription';
import { supabase } from './lib/supabase';

const Designers = lazy(() => import('./pages/Designers'));
const Projects = lazy(() => import('./pages/Projects'));
const Gallery = lazy(() => import('./pages/Gallery'));
const Materials = lazy(() => import('./pages/Materials'));
const DesignerDetail = lazy(() => import('./pages/DesignerDetail'));
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'));
const DesignerRegistration = lazy(() => import('./pages/DesignerRegistration'));
const CustomerRegistration = lazy(() => import('./pages/CustomerRegistration'));
const MyProjects = lazy(() => import('./pages/MyProjects'));
const EditProject = lazy(() => import('./pages/EditProject'));
const CustomerProjects = lazy(() => import('./pages/CustomerProjects'));
const ProjectDetailWithTracking = lazy(() => import('./pages/ProjectDetailWithTracking'));

const DesignerDashboard = lazy(() => import('./pages/DesignerDashboard'));
const DesignerMaterialPricing = lazy(() => import('./pages/DesignerMaterialPricing'));
const DesignerQuotes = lazy(() => import('./pages/DesignerQuotes'));
const DesignerQuoteGenerator = lazy(() => import('./pages/DesignerQuoteGenerator'));
const AIQuotationAssistant = lazy(() => import('./pages/AIQuotationAssistant'));

const CustomerQuotes = lazy(() => import('./pages/CustomerQuotes'));
const QuoteViewer = lazy(() => import('./pages/QuoteViewer'));

const DesignerSubscription = lazy(() => import('./pages/DesignerSubscription'));

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminDealsManagement = lazy(() => import('./pages/AdminDealsManagement'));
const AdminSubscriptionManagement = lazy(() => import('./pages/AdminSubscriptionManagement'));
const AdminAIQuotationSettings = lazy(() => import('./pages/AdminAIQuotationSettings'));
const AdminVideoManagement = lazy(() => import('./pages/AdminVideoManagement'));
const AdminWhatsAppSettings = lazy(() => import('./pages/AdminWhatsAppSettings'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));

const DebugPage = lazy(() => import('./pages/DebugPage'));
const DebugDesignerProfile = lazy(() => import('./pages/DebugDesignerProfile'));

const SharePhotoForm = lazy(() => import('./pages/SharePhotoForm'));
const ClearSession = lazy(() => import('./pages/ClearSession'));
const EmailConfirmation = lazy(() => import('./pages/EmailConfirmation'));

const WallpaperOrder = lazy(() => import('./pages/WallpaperOrder'));
const WallpaperGallery = lazy(() => import('./pages/WallpaperGallery'));
const AdminWallpaperOrders = lazy(() => import('./pages/AdminWallpaperOrders'));
const Admin3DWallpapers = lazy(() => import('./pages/Admin3DWallpapers'));
const AdminAuthDebug = lazy(() => import('./pages/AdminAuthDebug'));
const My3DWallpaperOrders = lazy(() => import('./pages/My3DWallpaperOrders'));

const DesignerBilling = lazy(() => import('./pages/DesignerBilling'));
const CustomerBillView = lazy(() => import('./pages/CustomerBillView'));
const BillDashboard = lazy(() => import('./pages/BillDashboard'));
const OfflineBillEditor = lazy(() => import('./pages/OfflineBillEditor'));

// Expose utilities to window for emergency use and debugging
if (typeof window !== 'undefined') {
  (window as any).forceLogoutAll = forceLogoutAll;
  (window as any).debugAuthState = debugAuthState;

  console.log(
    '%cDebug Commands Available:',
    'color: blue; font-size: 14px; font-weight: bold;'
  );

  console.log(
    '%cwindow.forceLogoutAll() - Force logout all users',
    'color: green;'
  );

  console.log(
    '%cwindow.debugAuthState() - Show current auth state',
    'color: green;'
  );
}

// Component to handle dashboard redirects for designers and admins
const DashboardRedirectHandler = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [redirecting, setRedirecting] = React.useState(false);

  useEffect(() => {
    const handleRedirect = async () => {
      // Wait for auth to finish loading
      if (authLoading || redirecting) {
        return;
      }

      // Only redirect from home page
      if (window.location.pathname !== '/') {
        return;
      }

      // If user is authenticated, detect type and redirect
      if (user) {
        console.log(
          'DashboardRedirectHandler: User logged in, detecting type...'
        );

        setRedirecting(true);

        try {
          const result = await detectUserTypeAndRedirect();

          if (result && result.redirectPath !== '/') {
            console.log(
              `DashboardRedirectHandler: Redirecting ${result.userType} to ${result.redirectPath}`
            );

            navigate(result.redirectPath);
          } else {
            console.log(
              'DashboardRedirectHandler: User has no registration'
            );
          }
        } catch (error) {
          console.error(
            'DashboardRedirectHandler: Error:',
            error
          );
        } finally {
          setRedirecting(false);
        }
      }
    };

    handleRedirect();
  }, [user, authLoading, navigate, redirecting]);

  return null;
};


/*
 * Everything inside this component is rendered AFTER AuthProvider.
 * Therefore useSubscription() and useDesignerProfile() can safely
 * access the authentication context.
 */
const AppContent: React.FC = () => {
  const location = useLocation();
  const [subscriptionManagementEnabled, setSubscriptionManagementEnabled] = useState(false);
const [subscriptionManagementLoading, setSubscriptionManagementLoading] = useState(true);

  const {
    subscription,
    loading: subscriptionLoading
  } = useSubscription();
  useEffect(() => {
  const fetchSubscriptionManagementSetting = async () => {
    try {
      const { data, error } = await supabase
        .from('site_settings')
        .select('is_active')
        .eq('setting_key', 'subscription_management_enabled')
        .maybeSingle();

      if (error) throw error;

      setSubscriptionManagementEnabled(data?.is_active === true);
    } catch (error) {
      console.error('Error fetching subscription management setting:', error);

      // If the setting cannot be read, do not block designers.
      setSubscriptionManagementEnabled(false);
    } finally {
      setSubscriptionManagementLoading(false);
    }
  };

  fetchSubscriptionManagementSetting();

  // Keep the global popup in sync if Admin changes the setting.
  const interval = window.setInterval(() => {
    fetchSubscriptionManagementSetting();
  }, 5000);

  return () => window.clearInterval(interval);
}, []);

  const {
    designer,
    loading: designerLoading
  } = useDesignerProfile();

  /*
   * The subscription page must remain usable.
   * Otherwise the expired popup would cover the Renew page itself.
   */
  const isSubscriptionPage =
    location.pathname === '/designer-subscription';

  /*
   * Show the expired popup only when:
   *
   * 1. Designer information has finished loading
   * 2. Subscription information has finished loading
   * 3. A designer exists
   * 4. Subscription is expired
   * 5. User is not currently on the renewal page
   */
 const showSubscriptionExpiredModal =
    !subscriptionManagementLoading &&
    subscriptionManagementEnabled &&
    !designerLoading &&
    !subscriptionLoading &&
    !!designer &&
    subscription.isExpired &&
    !isSubscriptionPage;

  return (
    <div className="min-h-screen flex flex-col">

      <DashboardRedirectHandler />

      {/* 
        Header stays outside the subscription popup.
        Therefore navbar tabs remain clickable.
      */}
      <Header />

      <main className="flex-grow">

        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
            </div>
          }
        >

          <Routes>

            <Route
              path="/"
              element={<Home />}
            />

            <Route
              path="/designers"
              element={<Designers />}
            />

            <Route
              path="/designers/:id"
              element={<DesignerDetail />}
            />

            <Route
              path="/projects"
              element={<Projects />}
            />

            <Route
              path="/projects/:id"
              element={<ProjectDetail />}
            />

            <Route
              path="/gallery"
              element={<Gallery />}
            />

            <Route
              path="/materials"
              element={<Materials />}
            />

            <Route
              path="/register-designer"
              element={<DesignerRegistration />}
            />

            <Route
              path="/edit-designer-profile"
              element={
                <ProtectedDesignerRoute>
                  <DesignerRegistration />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/register-customer"
              element={<CustomerRegistration />}
            />

            <Route
              path="/my-projects"
              element={<MyProjects />}
            />

            <Route
              path="/edit-project/:id"
              element={<EditProject />}
            />

            <Route
              path="/project-detail/:id"
              element={<ProjectDetailWithTracking />}
            />

            <Route
              path="/customer-projects"
              element={<CustomerProjects />}
            />

            <Route
              path="/designer-dashboard"
              element={
                <ProtectedDesignerRoute>
                  <DesignerDashboard />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/designer-material-pricing"
              element={
                <ProtectedDesignerRoute>
                  <DesignerMaterialPricing />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/designer-quotes"
              element={
                <ProtectedDesignerRoute>
                  <DesignerQuotes />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/customer-quotes"
              element={<CustomerQuotes />}
            />

            {/*
              IMPORTANT:
              This route remains accessible when subscription is expired
              so the designer can renew their subscription.
            */}
            <Route
              path="/designer-subscription"
              element={
                <ProtectedDesignerRoute>
                  <DesignerSubscription />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/generate-quote/:id"
              element={
                <ProtectedDesignerRoute>
                  <DesignerQuoteGenerator />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/ai-quotation/:id"
              element={
                <ProtectedDesignerRoute>
                  <AIQuotationAssistant />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/view-quote/:id"
              element={<QuoteViewer />}
            />

            <Route
              path="/admin"
              element={<AdminDashboard />}
            />

            <Route
              path="/admin/deals"
              element={<AdminDealsManagement />}
            />

            <Route
              path="/admin/subscriptions"
              element={<AdminSubscriptionManagement />}
            />

            <Route
              path="/admin/ai-quotation"
              element={<AdminAIQuotationSettings />}
            />

            <Route
              path="/admin/video"
              element={<AdminVideoManagement />}
            />

            <Route
              path="/admin/whatsapp"
              element={<AdminWhatsAppSettings />}
            />

            <Route
              path="/admin/wallpaper-orders"
              element={<AdminWallpaperOrders />}
            />

            <Route
              path="/admin/3d-wallpapers"
              element={<Admin3DWallpapers />}
            />

            <Route
              path="/admin/auth-debug"
              element={<AdminAuthDebug />}
            />

            <Route
              path="/admin-login"
              element={<AdminLogin />}
            />

            <Route
              path="/debug"
              element={<DebugPage />}
            />

            <Route
              path="/debug-profile"
              element={<DebugDesignerProfile />}
            />

            <Route
              path="/share-photo"
              element={<SharePhotoForm />}
            />

            <Route
              path="/clear-session"
              element={<ClearSession />}
            />

            <Route
              path="/3d-wallpaper"
              element={<WallpaperGallery />}
            />

            <Route
              path="/wallpaper-order"
              element={<WallpaperOrder />}
            />

            <Route
              path="/my-3d-wallpaper-orders"
              element={<My3DWallpaperOrders />}
            />

            <Route
              path="/project-bill/:projectId"
              element={
                <ProtectedDesignerRoute>
                  <DesignerBilling />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/my-bill/:projectId"
              element={<CustomerBillView />}
            />

            <Route
              path="/bills"
              element={
                <ProtectedDesignerRoute>
                  <BillDashboard />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/create-offline-bill"
              element={
                <ProtectedDesignerRoute>
                  <OfflineBillEditor />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/offline-bill/:billId"
              element={
                <ProtectedDesignerRoute>
                  <OfflineBillEditor />
                </ProtectedDesignerRoute>
              }
            />

            <Route
              path="/auth/confirm"
              element={<EmailConfirmation />}
            />

          </Routes>

        </Suspense>

      </main>

      <Footer />
      <Chatbot />
      <InstallPrompt />

      {/*
        Subscription popup.

        It is rendered AFTER Header so the Header/navbar can still
        be clicked.

        The modal itself will block the page content underneath it.
      */}
      {showSubscriptionExpiredModal && subscriptionManagementEnabled && (
      <SubscriptionExpiredModal isOpen={true} />
      )}

    </div>
  );
};


function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}
export default App;