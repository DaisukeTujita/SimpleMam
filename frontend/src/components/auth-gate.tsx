"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

export function useUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api<User>("/auth/me"),
    refetchInterval: 60_000,
  });
}

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const user = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const needsLogin =
    user.error instanceof ApiError && [401, 403].includes(user.error.status);
  useEffect(() => {
    if (needsLogin)
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [needsLogin, pathname, router]);
  if (user.isPending || needsLogin)
    return (
      <Box sx={{ p: 4 }}>
        <CircularProgress aria-label="ログイン確認中" />
      </Box>
    );
  if (user.error)
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{user.error.message}</Alert>
        <Button onClick={() => void user.refetch()}>再試行</Button>
      </Box>
    );
  return children;
}
