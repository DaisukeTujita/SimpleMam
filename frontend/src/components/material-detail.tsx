"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, programUrl } from "@/lib/api";
import type { Material, MaterialValues } from "@/lib/types";
import HlsPlayer from "./hls-player";
function values(material: Material): MaterialValues {
  const { title, category_code, genre_code, material_content, handover_note } =
    material;
  return { title, category_code, genre_code, material_content, handover_note };
}
type Usage = {
  id: number;
  name: string;
  on_air_date: string | null;
  small_block_name: string;
};
export default function MaterialDetail({
  number,
  basePath,
}: {
  number: string;
  basePath: string;
}) {
  const client = useQueryClient();
  const detail = useQuery({
    queryKey: ["material", number],
    queryFn: () => api<Material>(`/materials/${encodeURIComponent(number)}`),
  });
  const usages = useQuery({
    queryKey: ["usages", number],
    queryFn: () =>
      api<Usage[]>(`/materials/${encodeURIComponent(number)}/usages`),
  });
  const [edit, setEdit] = useState<{
    values: MaterialValues;
    expected: MaterialValues;
  } | null>(null);
  const save = useMutation({
    mutationFn: () =>
      api<Material>(`/materials/${encodeURIComponent(number)}`, {
        method: "PATCH",
        body: JSON.stringify(edit),
      }),
    onSuccess: async () => {
      setEdit(null);
      await client.invalidateQueries({ queryKey: ["material", number] });
      await client.invalidateQueries({ queryKey: ["materials"] });
    },
  });
  if (detail.isPending) return <CircularProgress aria-label="素材読み込み中" />;
  if (detail.error)
    return (
      <Alert
        severity="error"
        action={<Button onClick={() => void detail.refetch()}>再試行</Button>}
      >
        {detail.error.message}
      </Alert>
    );
  const material = detail.data;
  return (
    <Stack spacing={2}>
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Typography variant="h6" sx={{ overflowWrap: "anywhere" }}>
          {material.title || "（タイトルなし）"}
        </Typography>
        <Button
          variant="outlined"
          disabled={!material.can_edit}
          onClick={() => {
            save.reset();
            setEdit({ values: values(material), expected: values(material) });
          }}
        >
          編集
        </Button>
      </Stack>
      <Typography sx={{ overflowWrap: "anywhere" }}>
        素材番号：{material.number}
      </Typography>
      <HlsPlayer key={material.hls_url} src={material.hls_url} />
      <Box
        component="dl"
        sx={{
          m: 0,
          "& dt": { color: "text.secondary", mt: 1 },
          "& dd": { ml: 0, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
        }}
      >
        {[
          ["素材種別", material.material_type],
          ["状態", material.status],
          ["尺", material.duration],
          ["カテゴリ", material.category_code],
          ["ジャンル", material.genre_code],
          ["登録経路", material.registration_route],
          ["素材内容", material.material_content],
          ["引継ぎメモ", material.handover_note],
        ].map(([label, value]) => (
          <Box key={label}>
            <Typography component="dt">{label}</Typography>
            <Typography component="dd">{value || "—"}</Typography>
          </Box>
        ))}
      </Box>
      <Divider />
      <Typography variant="subtitle1">使用番組</Typography>
      {usages.isPending && <CircularProgress size={20} />}
      {usages.error && <Alert severity="error">{usages.error.message}</Alert>}
      {usages.data?.length === 0 && (
        <Typography color="text.secondary">使用番組はありません</Typography>
      )}
      {usages.data?.map((usage, i) => (
        <Button
          component={Link}
          key={`${usage.id}-${usage.on_air_date}-${i}`}
          href={programUrl(basePath, usage.id, usage.on_air_date)}
          sx={{ justifyContent: "flex-start" }}
        >
          {usage.on_air_date ?? "放送日未定"} {usage.name}／
          {usage.small_block_name}
        </Button>
      ))}
      <Dialog
        open={edit !== null}
        onClose={() => {
          if (!save.isPending) setEdit(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>素材情報の編集</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {edit &&
              (Object.keys(edit.values) as (keyof MaterialValues)[]).map(
                (key) => (
                  <TextField
                    key={key}
                    label={
                      {
                        title: "タイトル",
                        category_code: "カテゴリ",
                        genre_code: "ジャンル",
                        material_content: "素材内容",
                        handover_note: "引継ぎメモ",
                      }[key]
                    }
                    value={edit.values[key]}
                    multiline={
                      key === "material_content" || key === "handover_note"
                    }
                    minRows={
                      key === "material_content" || key === "handover_note"
                        ? 3
                        : 1
                    }
                    slotProps={{
                      htmlInput: {
                        maxLength: {
                          title: 128,
                          category_code: 2,
                          genre_code: 2,
                          material_content: 1000,
                          handover_note: 500,
                        }[key],
                      },
                    }}
                    onChange={(event) =>
                      setEdit({
                        ...edit,
                        values: { ...edit.values, [key]: event.target.value },
                      })
                    }
                  />
                ),
              )}
            {save.error && <Alert severity="error">{save.error.message}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button disabled={save.isPending} onClick={() => setEdit(null)}>
            キャンセル
          </Button>
          <Button
            disabled={save.isPending}
            variant="contained"
            onClick={() => save.mutate()}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
