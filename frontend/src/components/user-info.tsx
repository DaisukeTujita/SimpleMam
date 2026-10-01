"use client";
import { Alert, Button, Paper, Stack, Typography } from "@mui/material";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useUser } from "./auth-gate";
import { api } from "@/lib/api";

export default function UserInfo() {
  const user = useUser();
  const client = useQueryClient();
  const router = useRouter();
  const logout = useMutation({
    mutationFn: () => api("/auth/logout", { method: "POST" }),
    onSuccess: () => {
      client.clear();
      router.replace("/login");
    },
  });
  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h5">ユーザー情報</Typography>
        <Typography>ユーザー名：{user.data?.user_name}</Typography>
        <Typography>ユーザーID：{user.data?.user_id}</Typography>
        <Typography>グループ：{user.data?.group_name}</Typography>
        <Typography>権限：{user.data?.is_admin ? "管理者" : "一般"}</Typography>
        <Typography>
          グループの変更は、ログアウト後に再ログインしてください。
        </Typography>
        <Button
          variant="outlined"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
        >
          ログアウト
        </Button>
        {logout.error && <Alert severity="error">{logout.error.message}</Alert>}
      </Stack>
    </Paper>
  );
}
