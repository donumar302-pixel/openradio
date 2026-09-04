import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLogin, useRegister, useLogout } from "@workspace/api-client-react";
import { trackEvent } from "@/lib/analytics";

const AUTH_KEY = ["auth", "me"] as const;

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  isReseller: boolean;
  plan: string;
  credits: number;
  creditsUsed: number;
  planExpiresAt: string | null;
  status: string;
  createdAt: string;
}

async function fetchMe(): Promise<AuthUser> {
  const res = await fetch("/api/auth/me", { credentials: "include" });
  if (!res.ok) throw new Error("Unauthenticated");
  return res.json();
}

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading, isError } = useQuery({
    queryKey: AUTH_KEY,
    queryFn: fetchMe,
    retry: false,
    retryOnMount: false,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });

  const loginMutationRaw = useLogin();
  const registerMutationRaw = useRegister();
  const logoutMutation = useLogout();

  const login = (
    data: { email: string; password: string },
    callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }
  ) => {
    loginMutationRaw.mutate(
      { data },
      {
        onSuccess: (userData) => {
          trackEvent("login_completed", { method: "email" });
          queryClient.setQueryData(AUTH_KEY, userData);
          queryClient.invalidateQueries({ queryKey: AUTH_KEY });
          callbacks?.onSuccess?.();
        },
        onError: callbacks?.onError,
      }
    );
  };

  const register = (
    data: { name: string; email: string; password: string },
    callbacks?: { onSuccess?: () => void; onError?: (err: any) => void }
  ) => {
    registerMutationRaw.mutate(
      { data },
      {
        onSuccess: (userData) => {
          trackEvent("registration_completed", { method: "email" });
          queryClient.setQueryData(AUTH_KEY, userData);
          queryClient.invalidateQueries({ queryKey: AUTH_KEY });
          callbacks?.onSuccess?.();
        },
        onError: callbacks?.onError,
      }
    );
  };

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(AUTH_KEY, null);
        queryClient.clear();
        window.location.href = "/login";
      },
    });
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user && !isError,
    isAdmin: !!user?.isAdmin,
    isReseller: !!user?.isReseller,
    login,
    register,
    loginPending: loginMutationRaw.isPending,
    registerPending: registerMutationRaw.isPending,
    logout,
  };
}
