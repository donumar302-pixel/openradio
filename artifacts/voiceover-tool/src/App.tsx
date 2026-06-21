import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import StudioPage from "@/pages/studio";
import AdminDashboard from "@/pages/admin/index";
import AdminKeysNew from "@/pages/admin/keys/new";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import SpeechToSpeechPage from "@/pages/speech-to-speech";
import SpeechToTextPage from "@/pages/speech-to-text";
import AudioIsolationPage from "@/pages/audio-isolation";
import DubbingPage from "@/pages/dubbing";
import SettingsPage from "@/pages/settings";
import { SidebarLayout } from "@/components/sidebar-layout";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
    },
  },
});

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

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
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route>
          <Redirect to="/login" />
        </Route>
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
        <Route path="/admin" component={AdminDashboard} />
        <Route path="/admin/keys/new" component={AdminKeysNew} />
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
