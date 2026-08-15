import { Switch, Route, Router as WouterRouter, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import StudioPage from "@/pages/studio";
import AdminDashboard from "@/pages/admin/index";
import AdminKeysNew from "@/pages/admin/keys/new";
import AdminUsers from "@/pages/admin/users";
import AdminKeys from "@/pages/admin/keys";
import AdminGenerations from "@/pages/admin/generations";
import AdminClones from "@/pages/admin/clones";
import AdminAnalytics from "@/pages/admin/analytics";
import AdminOrders from "@/pages/admin/orders";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import LandingPage from "@/pages/landing";
import PricingPage from "@/pages/pricing";
import ToolsPage from "@/pages/tools";
import { PrivacyPage, TermsPage, RefundPage, CookiesPage, ContactPage } from "@/pages/legal";
import SpeechToSpeechPage from "@/pages/speech-to-speech";
import SpeechToTextPage from "@/pages/speech-to-text";
import AudioIsolationPage from "@/pages/audio-isolation";
import DubbingPage from "@/pages/dubbing";
import SettingsPage from "@/pages/settings";
import BatchTtsPage from "@/pages/batch-tts";
import VoiceCloningPage from "@/pages/voice-cloning";
import VoiceLibraryPage from "@/pages/voices";
import { SidebarLayout } from "@/components/sidebar-layout";
import { AdminLayout } from "@/components/admin-layout";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false },
  },
});

function AdminRoutes() {
  return (
    <AdminLayout>
      <Switch>
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/users" component={AdminUsers} />
        <Route path="/admin/orders" component={AdminOrders} />
        <Route path="/admin/keys" component={AdminKeys} />
        <Route path="/admin/keys/new" component={AdminKeysNew} />
        <Route path="/admin/generations" component={AdminGenerations} />
        <Route path="/admin/clones" component={AdminClones} />
        <Route path="/admin/analytics" component={AdminAnalytics} />
        <Route><Redirect to="/admin" /></Route>
      </Switch>
    </AdminLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated, isAdmin, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={LandingPage} />
        <Route path="/pricing" component={PricingPage} />
        <Route path="/tools" component={ToolsPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/terms" component={TermsPage} />
        <Route path="/refund-policy" component={RefundPage} />
        <Route path="/cookies" component={CookiesPage} />
        <Route path="/contact" component={ContactPage} />
        <Route><Redirect to="/" /></Route>
      </Switch>
    );
  }

  if (location.startsWith("/admin")) {
    if (!isAdmin) {
      return <Redirect to="/" />;
    }
    return <AdminRoutes />;
  }

  if (location === "/pricing") {
    return <PricingPage />;
  }

  if (location === "/privacy") return <PrivacyPage />;
  if (location === "/terms") return <TermsPage />;
  if (location === "/refund-policy") return <RefundPage />;
  if (location === "/cookies") return <CookiesPage />;
  if (location === "/contact") return <ContactPage />;

  return (
    <SidebarLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/studio" component={StudioPage} />
        <Route path="/speech-to-speech" component={SpeechToSpeechPage} />
        <Route path="/speech-to-text" component={SpeechToTextPage} />
        <Route path="/audio-isolation" component={AudioIsolationPage} />
        <Route path="/dubbing" component={DubbingPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/batch" component={BatchTtsPage} />
        <Route path="/minimax"><Redirect to="/studio" /></Route>
        <Route path="/voice-cloning" component={VoiceCloningPage} />
        <Route path="/voices" component={VoiceLibraryPage} />
        <Route path="/login"><Redirect to="/" /></Route>
        <Route path="/register"><Redirect to="/" /></Route>
        <Route component={NotFound} />
      </Switch>
    </SidebarLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") || ""}>
            <AppRoutes />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
