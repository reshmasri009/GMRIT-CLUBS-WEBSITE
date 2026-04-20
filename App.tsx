import { ReactNode, useEffect } from "react";
import { Redirect, Route, Switch, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { MainLayout } from "@/components/layout/MainLayout";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { Toaster } from "@/components/ui/toaster";
import { Login } from "@/pages/auth/Login";
import { Register } from "@/pages/auth/Register";
import { Announcements } from "@/pages/Announcements";
import { Events } from "@/pages/Events";
import { Clubs } from "@/pages/Clubs";
import About from "@/pages/About";
import Contact from "@/pages/Contact";
import Dashboard from "@/pages/dashboard";
import Profile from "@/pages/Profile";
import Home from "@/pages/Home";
import MyEvents from "@/pages/MyEvents";
import ClubDetails from "@/pages/ClubDetails";
import Certificates from "@/pages/Certificates";
import AdminScanQRPage from "@/pages/admin/AdminScanQRPage";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AnnouncementAdmin from "@/pages/admin/AnnouncementAdmin";
import ClubAdmin from "@/pages/admin/ClubAdmin";
import EventsAdmin from "@/pages/admin/EventsAdmin";
import ResultsAdmin from "@/pages/admin/ResultsAdmin";
import PlacementsAdmin from "@/pages/admin/PlacementsAdmin";
import CompaniesAdmin from "@/pages/admin/CompaniesAdmin";
import MaterialsAdmin from "@/pages/admin/MaterialsAdmin";
import CertificatesAdmin from "@/pages/admin/CertificatesAdmin";
import FeedAdmin from "@/pages/admin/FeedAdmin";
import UserManagement from "@/pages/admin/UserManagement";
import SupportDashboard from "@/pages/admin/SupportDashboard";
import CampusFeed from "@/pages/feed/CampusFeed";
import Results from "@/pages/results/Results";
import Placements from "@/pages/placements/Placements";
import PlacementDetail from "@/pages/placements/PlacementDetail";
import Companies from "@/pages/companies/Companies";
import CodingQuestions from "@/pages/companies/CodingQuestions";
import Aptitude from "@/pages/companies/Aptitude";
import Reasoning from "@/pages/companies/Reasoning";
import Verbal from "@/pages/companies/Verbal";
import DSATopics from "@/pages/companies/DSATopics";
import QuestionView from "@/pages/companies/QuestionView";
import { Materials } from "@/pages/materials/Materials";
import CategoryPage from "@/pages/materials/CategoryPage";
import SubCategoryPage from "@/pages/materials/SubCategoryPage";
import MaterialTopic from "@/pages/materials/MaterialTopic";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function RouteGuard({
  children,
  adminOnly = false,
  guestOnly = false,
}: {
  children: ReactNode;
  adminOnly?: boolean;
  guestOnly?: boolean;
}) {
  const { isAuthenticated, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return <div className="min-h-screen bg-background" />;
  }

  if (guestOnly && isAuthenticated) {
    return <Redirect to={isAdmin ? "/dashboard/admin" : "/dashboard"} />;
  }

  if (!guestOnly && !isAuthenticated) {
    return <Redirect to="/login" />;
  }

  if (adminOnly && !isAdmin) {
    return <Redirect to="/dashboard" />;
  }

  return <>{children}</>;
}

function DashboardShell({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminLayout>{children}</AdminLayout> : <MainLayout>{children}</MainLayout>;
}

function RootRedirect() {
  const { isAuthenticated, isAdmin } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate("/login", { replace: true });
      return;
    }
    navigate(isAdmin ? "/dashboard/admin" : "/dashboard", { replace: true });
  }, [isAuthenticated, isAdmin, navigate]);

  return null;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/">
        <RootRedirect />
      </Route>

      <Route path="/home">
        <Home />
      </Route>
      <Route path="/about">
        <About />
      </Route>
      <Route path="/contact">
        <Contact />
      </Route>

      <Route path="/login">
        <RouteGuard guestOnly>
          <Login />
        </RouteGuard>
      </Route>
      <Route path="/register">
        <RouteGuard guestOnly>
          <Register />
        </RouteGuard>
      </Route>

      <Route path="/dashboard/:rest*">
        <RouteGuard>
          <DashboardShell>
            <Switch>
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/dashboard/about" component={About} />
              <Route path="/dashboard/contact" component={Contact} />
              <Route path="/dashboard/profile" component={Profile} />
              <Route path="/dashboard/announcements" component={Announcements} />
              <Route path="/dashboard/events" component={Events} />
              <Route path="/dashboard/my-events" component={MyEvents} />
              <Route path="/dashboard/clubs" component={Clubs} />
              <Route path="/dashboard/clubs/:id" component={ClubDetails} />
              <Route path="/dashboard/feed" component={CampusFeed} />
              <Route path="/dashboard/results" component={Results} />
              <Route path="/dashboard/placements" component={Placements} />
              <Route path="/dashboard/placements/:id" component={PlacementDetail} />
              <Route path="/dashboard/companies" component={Companies} />
              <Route path="/dashboard/companies/coding" component={CodingQuestions} />
              <Route path="/dashboard/companies/coding/:id" component={QuestionView} />
              <Route path="/dashboard/companies/aptitude" component={Aptitude} />
              <Route path="/dashboard/companies/reasoning" component={Reasoning} />
              <Route path="/dashboard/companies/verbal" component={Verbal} />
              <Route path="/dashboard/companies/dsa" component={DSATopics} />
              <Route path="/dashboard/materials" component={Materials} />
              <Route path="/dashboard/materials/category/:id" component={CategoryPage} />
              <Route path="/dashboard/materials/subcategory/:id" component={SubCategoryPage} />
              <Route path="/dashboard/materials/topic/:id" component={MaterialTopic} />
              <Route path="/dashboard/certificates" component={Certificates} />

              <Route path="/dashboard/admin">
                <RouteGuard adminOnly>
                  <AdminDashboard />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/users">
                <RouteGuard adminOnly>
                  <UserManagement />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/feed">
                <RouteGuard adminOnly>
                  <FeedAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/announcements">
                <RouteGuard adminOnly>
                  <AnnouncementAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/clubs">
                <RouteGuard adminOnly>
                  <ClubAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/events">
                <RouteGuard adminOnly>
                  <EventsAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/results">
                <RouteGuard adminOnly>
                  <ResultsAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/placements">
                <RouteGuard adminOnly>
                  <PlacementsAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/companies">
                <RouteGuard adminOnly>
                  <CompaniesAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/materials">
                <RouteGuard adminOnly>
                  <MaterialsAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/certificates">
                <RouteGuard adminOnly>
                  <CertificatesAdmin />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin/support">
                <RouteGuard adminOnly>
                  <SupportDashboard />
                </RouteGuard>
              </Route>
              <Route path="/dashboard/admin-scan-qr">
                <RouteGuard adminOnly>
                  <AdminScanQRPage />
                </RouteGuard>
              </Route>
              <Route component={NotFound} />
            </Switch>
          </DashboardShell>
        </RouteGuard>
      </Route>

      <Route path="/admin">
        <Redirect to="/dashboard/admin" />
      </Route>
      <Route path="/admin-scan-qr">
        <Redirect to="/dashboard/admin-scan-qr" />
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
