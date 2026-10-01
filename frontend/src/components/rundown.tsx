"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Chip,
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
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, programUrl } from "@/lib/api";
import type { Rundown as RundownData, SmallBlock } from "@/lib/types";
import MaterialDetail from "./material-detail";
type Action = {
  method: string;
  path: string;
  title: string;
  name: string;
  expected?: string;
  deleting?: boolean;
};
export default function Rundown({
  id,
  date,
  basePath,
  preview = false,
}: {
  id: number;
  date: string | null;
  basePath: string;
  preview?: boolean;
}) {
  const client = useQueryClient();
  const dateQuery = `?on_air_date=${encodeURIComponent(date ?? "undated")}`;
  const root = `/programs/${id}/rundown`;
  const query = useQuery({
    queryKey: ["rundown", id, date],
    queryFn: () => api<RundownData>(root + dateQuery),
  });
  const [action, setAction] = useState<Action | null>(null);
  const [material, setMaterial] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      if (!action) throw new Error("操作が選択されていません");
      return api(action.path + dateQuery, {
        method: action.method,
        body: JSON.stringify(
          action.deleting
            ? { expected: action.expected }
            : {
                name: action.name,
                ...(action.expected === undefined
                  ? {}
                  : { expected: action.expected }),
              },
        ),
      });
    },
    onSuccess: async () => {
      setAction(null);
      await client.invalidateQueries({ queryKey: ["rundown", id, date] });
      await client.invalidateQueries({ queryKey: ["programs"] });
    },
  });
  function open(next: Action) {
    save.reset();
    setAction(next);
  }
  if (query.isPending)
    return <CircularProgress aria-label="運行表読み込み中" />;
  if (query.error)
    return (
      <Alert
        severity="error"
        action={<Button onClick={() => void query.refetch()}>再試行</Button>}
      >
        {query.error.message}
      </Alert>
    );
  const { program, large_blocks, bucket } = query.data;
  const canEdit = !preview && program.can_edit;
  function smallRows(items: SmallBlock[]) {
    return items.map((item) => (
      <Box key={item.id} sx={{ p: 1, borderBottom: 1, borderColor: "divider" }}>
        <Stack
          direction="row"
          spacing={1}
          useFlexGap
          sx={{ alignItems: "center", flexWrap: "wrap" }}
        >
          <Typography sx={{ flex: 1 }}>
            {item.name || "（名称なし）"}
          </Typography>
          {item.is_blank && <Chip label="白素材" size="small" />}
          {!preview && (
            <>
              <Button
                disabled={!canEdit}
                onClick={() =>
                  open({
                    method: "PATCH",
                    path: `${root}/small-blocks/${item.id}`,
                    title: "小項目名の編集",
                    name: item.name,
                    expected: item.name,
                  })
                }
              >
                編集
              </Button>
              <Button
                color="error"
                disabled={!canEdit}
                onClick={() =>
                  open({
                    method: "DELETE",
                    path: `${root}/small-blocks/${item.id}`,
                    title: "小項目を削除",
                    name: item.name,
                    expected: item.name,
                    deleting: true,
                  })
                }
              >
                削除
              </Button>
            </>
          )}
        </Stack>
        {item.material_number ? (
          <Button
            onClick={() => setMaterial(item.material_number)}
            sx={{ maxWidth: "100%" }}
          >
            <Typography noWrap>{item.material_number}</Typography>
          </Button>
        ) : (
          <Typography variant="caption" color="text.secondary">
            素材未割当
          </Typography>
        )}
      </Box>
    ));
  }
  return (
    <Stack spacing={2}>
      <Box>
        <Typography color="text.secondary">
          {program.on_air_date ?? "放送日未定"}　{program.start_time} ～{" "}
          {program.end_time}
        </Typography>
        <Typography variant="h5">{program.name}</Typography>
      </Box>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
        {preview ? (
          <Button
            component={Link}
            href={programUrl(basePath, id, date)}
            variant="contained"
          >
            詳細を開く
          </Button>
        ) : (
          <>
            <Button component={Link} href={`${basePath}/programs`}>
              番組検索へ
            </Button>
            <Button
              disabled={!canEdit}
              onClick={() =>
                open({
                  method: "PATCH",
                  path: `/programs/${id}`,
                  title: "番組名の編集",
                  name: program.name,
                  expected: program.name,
                })
              }
            >
              番組名を編集
            </Button>
            <Button
              variant="outlined"
              disabled={!canEdit}
              onClick={() =>
                open({
                  method: "POST",
                  path: `${root}/large-blocks`,
                  title: "大項目を追加",
                  name: "",
                })
              }
            >
              大項目を追加
            </Button>
          </>
        )}
        <Button onClick={() => void query.refetch()}>更新</Button>
      </Stack>
      {large_blocks.length === 0 && (
        <Typography color="text.secondary">大項目はありません</Typography>
      )}
      {large_blocks.map((block) => (
        <Accordion key={block.number} defaultExpanded disableGutters>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Typography>
              {block.display_number}　{block.name}
            </Typography>
            {block.is_discarded && (
              <Chip label="破棄" size="small" sx={{ ml: 1 }} />
            )}
          </AccordionSummary>
          <AccordionDetails>
            {!preview && (
              <Stack
                direction="row"
                spacing={1}
                useFlexGap
                sx={{ flexWrap: "wrap" }}
              >
                <Button
                  disabled={!canEdit}
                  onClick={() =>
                    open({
                      method: "PATCH",
                      path: `${root}/large-blocks/${block.number}`,
                      title: "大項目名の編集",
                      name: block.name,
                      expected: block.name,
                    })
                  }
                >
                  名称編集
                </Button>
                <Button
                  disabled={!canEdit}
                  onClick={() =>
                    open({
                      method: "POST",
                      path: `${root}/large-blocks/${block.number}/small-blocks`,
                      title: "小項目を追加",
                      name: "",
                    })
                  }
                >
                  小項目を追加
                </Button>
                <Button
                  disabled={!canEdit}
                  color="error"
                  onClick={() =>
                    open({
                      method: "DELETE",
                      path: `${root}/large-blocks/${block.number}`,
                      title: "大項目と配下の小項目を削除",
                      name: block.name,
                      expected: block.name,
                      deleting: true,
                    })
                  }
                >
                  削除
                </Button>
              </Stack>
            )}
            {smallRows(block.children)}
          </AccordionDetails>
        </Accordion>
      ))}
      <Divider />
      <Typography variant="h6">未配置の小項目</Typography>
      {!preview && (
        <Button
          disabled={!canEdit}
          onClick={() =>
            open({
              method: "POST",
              path: `${root}/large-blocks/0/small-blocks`,
              title: "未配置の小項目を追加",
              name: "",
            })
          }
        >
          小項目を追加
        </Button>
      )}
      {smallRows(bucket)}
      <Dialog
        open={action !== null}
        onClose={() => {
          if (!save.isPending) setAction(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>{action?.title}</DialogTitle>
        <DialogContent>
          {action?.deleting ? (
            <Alert severity="warning">
              「{action.name}
              」を削除します。大項目の削除では配下の小項目も削除されます。
            </Alert>
          ) : (
            <TextField
              autoFocus
              fullWidth
              label="名称"
              value={action?.name ?? ""}
              sx={{ mt: 1 }}
              slotProps={{ htmlInput: { maxLength: 128 } }}
              onChange={(e) => {
                if (action) setAction({ ...action, name: e.target.value });
              }}
            />
          )}
          {save.error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {save.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button disabled={save.isPending} onClick={() => setAction(null)}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            color={action?.deleting ? "error" : "primary"}
            disabled={
              save.isPending || (!action?.deleting && !action?.name.trim())
            }
            onClick={() => save.mutate()}
          >
            {action?.deleting ? "削除" : "保存"}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={material !== null}
        onClose={() => setMaterial(null)}
        fullWidth
        maxWidth="md"
      >
        <DialogTitle>
          <Button onClick={() => setMaterial(null)}>閉じる</Button>
        </DialogTitle>
        <DialogContent>
          {material && (
            <MaterialDetail
              key={material}
              number={material}
              basePath={basePath}
            />
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
