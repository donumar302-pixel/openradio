import { useGetMe, useLogin, useRegister, useLogout, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

export function useAuth() {
  const queryClient = useQueryClient();
  const getMeKey = getGetMeQueryKey();

  const { data: user, isLoading, isError } = useGetMe({
    query: {
      retry: false,
      retryOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      staleTime: 1000 * 60 * 5,
    },
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
          queryClient.setQueryData(getMeKey, userData);
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
          queryClient.setQueryData(getMeKey, userData);
          callbacks?.onSuccess?.();
        },
        onError: callbacks?.onError,
      }
    );
  };

  const logout = () => {
    logoutMutation.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      },
    });
  };

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user && !isError,
    login,
    register,
    loginPending: loginMutationRaw.isPending,
    registerPending: registerMutationRaw.isPending,
    logout,
  };
}
