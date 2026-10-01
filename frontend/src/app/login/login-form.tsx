"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group } from "@/lib/types";
import { useUser } from "@/components/auth-gate";

export default function LoginForm() {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const user = useUser();
  const client = useQueryClient();
  const router = useRouter();
  const next = useSearchParams().get("next") ?? "/pc/materials";
  const destination =
    /^\/(pc|mobile)(\/|$)/.test(next) && !next.includes("\\")
      ? next
      : "/pc/materials";
  const needsGroup =
    loggedIn || (user.error instanceof ApiError && user.error.status === 403);
  const groups = useQuery({
    queryKey: ["groups"],
    queryFn: () => api<Group[]>("/auth/groups"),
    enabled: needsGroup,
  });
  const login = useMutation({
    mutationFn: () =>
      api("/auth/login", {
        method: "POST",
        body: JSON.stringify({ user_id: userId, password }),
      }),
    onSuccess: () => {
      setLoggedIn(true);
      setPassword("");
      void client.invalidateQueries({ queryKey: ["groups"] });
    },
  });
  const select = useMutation({
    mutationFn: (id: string) =>
      api("/auth/select-group", {
        method: "POST",
        body: JSON.stringify({ group_id: id }),
      }),
    onSuccess: async () => {
      client.clear();
      await client.invalidateQueries({ queryKey: ["me"] });
      router.replace(destination);
    },
  });
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      setLoggedIn(false);
      client.clear();
      window.location.reload();
    },
  });
  useEffect(() => {
    if (user.data) router.replace(destination);
  }, [user.data, destination, router]);
  const error =
    login.error ??
    select.error ??
    logout.error ??
    (needsGroup ? groups.error : null);
  return (
    <Box sx={{ maxWidth: 440, mx: "auto", mt: 8, px: 2 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          SimpleMam
        </Typography>
        {user.isPending ? (
          <CircularProgress />
        ) : needsGroup ? (
          <Stack spacing={2}>
            <Typography>使用するグループを選択してください</Typography>
            {groups.isPending && <CircularProgress />}
            {groups.data?.map((group) => (
              <Button
                key={group.group_id}
                variant="outlined"
                disabled={select.isPending}
                onClick={() => select.mutate(group.group_id)}
              >
                {group.group_name}
              </Button>
            ))}
            {groups.data?.length === 0 && (
              <Alert severity="warning">所属グループがありません</Alert>
            )}
            <Button onClick={() => logout.mutate()} disabled={logout.isPending}>
              ログアウト
            </Button>
          </Stack>
        ) : (
          <Stack
            component="form"
            spacing={2}
            onSubmit={(event) => {
              event.preventDefault();
              login.mutate();
            }}
          >
            <TextField
              label="ユーザーID"
              required
              autoComplete="username"
              value={userId}
              onChange={(event) => setUserId(event.target.value)}
            />
            <TextField
              label="パスワード"
              required
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={login.isPending}
            >
              ログイン
            </Button>
          </Stack>
        )}
        {user.error &&
          user.error instanceof ApiError &&
          user.error.status >= 500 && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {user.error.message}
            </Alert>
          )}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error.message}
          </Alert>
        )}
      </Paper>
    </Box>
  );
}
