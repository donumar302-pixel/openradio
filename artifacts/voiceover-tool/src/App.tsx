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
import AdminPromos from "@/pages/admin/promos";
import AdminNotifications from "@/pages/admin/notifications";
import AdminSupport from "@/pages/admin/support";
import AdminSettings from "@/pages/admin/settings";
import AdminAbuse from "@/pages/admin/abuse";
import SupportPage from "@/pages/support";
import AdminResellers from "@/pages/admin/resellers";
import ResellerPanel from "@/pages/reseller/index";
import ResellerLogin from "@/pages/reseller/login";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import LandingPage from "@/pages/landing";
import PricingPage from "@/pages/pricing";
import ToolsPage from "@/pages/tools";
import { PrivacyPage, TermsPage, RefundPage, CookiesPage, ContactPage } from "@/pages/legal";
import { BlogIndexPage, BlogArticlePage } from "@/pages/blog";
import SpeechToSpeechPage from "@/pages/speech-to-speech";
import SpeechToTextPage from "@/pages/speech-to-text";
import AudioIsolationPage from "@/pages/audio-isolation";
import DubbingPage from "@/pages/dubbing";
import SettingsPage from "@/pages/settings";
import BatchTtsPage from "@/pages/batch-tts";
import ScriptWriterPage from "@/pages/script-writer";
import DialoguePage from "@/pages/dialogue";
import PronunciationDictionaryPage from "@/pages/pronunciation-dictionary";
import SoundEffectsPage from "@/pages/sound-effects";
import AiMusicPage from "@/pages/ai-music";
import ImageStudioPage from "@/pages/image-studio";
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
        <Route path="/adminarea" component={AdminDashboard} />
        <Route path="/adminarea/users" component={AdminUsers} />
        <Route path="/adminarea/orders" component={AdminOrders} />
        <Route path="/adminarea/keys" component={AdminKeys} />
        <Route path="/adminarea/keys/new" component={AdminKeysNew} />
        <Route path="/adminarea/generations" component={AdminGenerations} />
        <Route path="/adminarea/clones" component={AdminClones} />
        <Route path="/adminarea/analytics" component={AdminAnalytics} />
        <Route path="/adminarea/promos" component={AdminPromos} />
        <Route path="/adminarea/notifications" component={AdminNotifications} />
        <Route path="/adminarea/support" component={AdminSupport} />
        <Route path="/adminarea/settings" component={AdminSettings} />
        <Route path="/adminarea/abuse" component={AdminAbuse} />
        <Route path="/adminarea/resellers" component={AdminResellers} />
        <Route><Redirect to="/adminarea" /></Route>
      </Switch>
    </AdminLayout>
  );
}

function AppRoutes() {
  const { isAuthenticated, isAdmin, isReseller, isLoading } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Reseller panel is reachable from anywhere, on any device, regardless of
  // main-app session state: /reseller and any sub-path always resolve to the
  // panel (for logged-in resellers) or the dedicated reseller login page
  // (for everyone else — including users logged in with a non-reseller account,
  // who can sign in with their reseller credentials there).
  if (location.startsWith("/reseller")) {
    if (isAuthenticated && isReseller) {
      return <ResellerPanel />;
    }
    return <ResellerLogin />;
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
        <Route path="/blog" component={BlogIndexPage} />
        <Route path="/blog/:slug" component={BlogArticlePage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  if (location.startsWith("/adminarea")) {
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
  if (location === "/blog" || location.startsWith("/blog/")) {
    return (
      <Switch>
        <Route path="/blog" component={BlogIndexPage} />
        <Route path="/blog/:slug" component={BlogArticlePage} />
        <Route component={NotFound} />
      </Switch>
    );
  }

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
        <Route path="/support" component={SupportPage} />
        <Route path="/batch" component={BatchTtsPage} />
        <Route path="/script-writer" component={ScriptWriterPage} />
        <Route path="/dialogue" component={DialoguePage} />
        <Route path="/dictionary" component={PronunciationDictionaryPage} />
        <Route path="/sound-effects" component={SoundEffectsPage} />
        <Route path="/music" component={AiMusicPage} />
        <Route path="/images" component={ImageStudioPage} />
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
