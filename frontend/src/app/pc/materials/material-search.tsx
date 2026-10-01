"use client";
import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useQuery } from "@tanstack/react-query";
import { api, day, queryString } from "@/lib/api";
import type { Material, Page } from "@/lib/types";
import MaterialDetail from "@/components/material-detail";
import Thumbnail from "@/components/thumbnail";
const initial = () => ({
  created_from: day(),
  created_to: day(),
  title: "",
  number: "",
  category_code: "",
  genre_code: "",
  route: "",
  status: "",
  material_type: "",
});
export default function MaterialSearch() {
  const [draft, setDraft] = useState(initial);
  const [criteria, setCriteria] = useState(initial);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState("list");
  const query = useQuery({
    queryKey: ["materials", criteria, page, pageSize],
    queryFn: () =>
      api<Page<Material>>(
        `/materials?${queryString({ ...criteria, page: page + 1, page_size: pageSize })}`,
      ),
  });
  function search(next = draft) {
    setCriteria({ ...next });
    setPage(0);
    setSelected(null);
  }
  function date(offset: number) {
    const next = {
      ...draft,
      created_from: day(offset),
      created_to: day(offset),
    };
    setDraft(next);
    search(next);
  }
  return (
    <Stack spacing={2} sx={{ height: "100%", minHeight: 0 }}>
      <Typography variant="h5">素材検索</Typography>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>
            検索条件　{criteria.created_from || "指定なし"} ～{" "}
            {criteria.created_to || "指定なし"}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack
            component="form"
            spacing={2}
            onSubmit={(event) => {
              event.preventDefault();
              search();
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              <TextField
                type="date"
                label="作成日・開始"
                value={draft.created_from}
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(e) =>
                  setDraft({ ...draft, created_from: e.target.value })
                }
              />
              <TextField
                type="date"
                label="作成日・終了"
                value={draft.created_to}
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(e) =>
                  setDraft({ ...draft, created_to: e.target.value })
                }
              />
              <Button onClick={() => date(-1)}>前日</Button>
              <Button onClick={() => date(0)}>本日</Button>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {(
                [
                  ["title", "タイトル"],
                  ["number", "素材番号"],
                  ["category_code", "カテゴリ"],
                  ["genre_code", "ジャンル"],
                  ["route", "登録経路"],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                  sx={{ width: key === "title" ? 280 : 160 }}
                />
              ))}
              <TextField
                select
                label="素材種別"
                value={draft.material_type}
                sx={{ width: 140 }}
                onChange={(e) =>
                  setDraft({ ...draft, material_type: e.target.value })
                }
              >
                <MenuItem value="">すべて</MenuItem>
                <MenuItem value="1">元素材</MenuItem>
                <MenuItem value="2">OA素材</MenuItem>
              </TextField>
              <Button type="submit" variant="contained">
                検索
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>
      <Stack
        direction="row"
        spacing={1}
        useFlexGap
        sx={{ alignItems: "center", flexWrap: "wrap" }}
      >
        {["", "未登録", "登録中", "登録完了", "キャンセル", "エラー"].map(
          (status) => (
            <Button
              key={status}
              variant={criteria.status === status ? "contained" : "outlined"}
              onClick={() => {
                const next = { ...draft, status };
                setDraft(next);
                search(next);
              }}
            >
              {status || "すべて"}{" "}
              {status
                ? (query.data?.status_counts?.[status] ?? 0)
                : Object.values(query.data?.status_counts ?? {}).reduce(
                    (a, b) => a + b,
                    0,
                  )}
            </Button>
          ),
        )}
        <ToggleButtonGroup
          size="small"
          exclusive
          value={view}
          onChange={(_, value) => {
            if (value) setView(value);
          }}
        >
          <ToggleButton value="list">一覧</ToggleButton>
          <ToggleButton value="thumbnail">サムネイル</ToggleButton>
        </ToggleButtonGroup>
        <Button onClick={() => void query.refetch()}>更新</Button>
      </Stack>
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {query.isPending && <CircularProgress aria-label="素材検索中" />}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: selected
            ? "minmax(0,1fr) minmax(0,1fr)"
            : "minmax(0,1fr)",
          flex: 1,
          minHeight: 200,
          gap: 2,
        }}
      >
        <Paper
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {view === "list" ? (
            <TableContainer sx={{ flex: 1 }}>
              <Table stickyHeader sx={{ minWidth: 900 }}>
                <TableHead>
                  <TableRow>
                    {[
                      "素材番号",
                      "タイトル",
                      "素材種別",
                      "状態",
                      "尺",
                      "カテゴリ",
                      "ジャンル",
                      "作成日",
                    ].map((label) => (
                      <TableCell key={label} sx={{ whiteSpace: "nowrap" }}>
                        {label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {query.data?.items.map((material) => (
                    <TableRow
                      key={material.number}
                      hover
                      selected={selected === material.number}
                      onClick={() => setSelected(material.number)}
                      sx={{ cursor: "pointer" }}
                    >
                      <TableCell
                        sx={{
                          width: 140,
                          maxWidth: 140,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        title={material.number}
                      >
                        {material.number}
                      </TableCell>
                      <TableCell sx={{ minWidth: 220 }}>
                        {material.title}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {material.material_type}
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={material.status} />
                      </TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {material.duration}
                      </TableCell>
                      <TableCell>{material.category_code}</TableCell>
                      <TableCell>{material.genre_code}</TableCell>
                      <TableCell sx={{ whiteSpace: "nowrap" }}>
                        {material.created_at?.replace("T", " ").slice(0, 19)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Box
              sx={{
                flex: 1,
                overflow: "auto",
                p: 1,
                display: "grid",
                alignContent: "start",
                gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))",
                gap: 2,
              }}
            >
              {query.data?.items.map((material) => (
                <Card
                  key={material.number}
                  variant="outlined"
                  sx={{
                    borderColor:
                      selected === material.number ? "primary.main" : undefined,
                  }}
                >
                  <CardActionArea onClick={() => setSelected(material.number)}>
                    <Thumbnail
                      key={material.thumbnail_url}
                      src={material.thumbnail_url}
                    />
                    <CardContent>
                      <Typography noWrap title={material.number}>
                        {material.number}
                      </Typography>
                      <Typography noWrap>{material.title}</Typography>
                      <Chip label={material.status} size="small" />
                    </CardContent>
                  </CardActionArea>
                </Card>
              ))}
            </Box>
          )}
          {query.data?.items.length === 0 && (
            <Typography sx={{ p: 2 }}>
              条件に一致する素材はありません
            </Typography>
          )}
          <TablePagination
            component="div"
            count={query.data?.total ?? 0}
            page={page}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[25, 50, 100]}
            onPageChange={(_, p) => {
              setPage(p);
              setSelected(null);
            }}
            onRowsPerPageChange={(event) => {
              setPageSize(Number(event.target.value));
              setPage(0);
              setSelected(null);
            }}
            labelRowsPerPage="表示件数"
          />
        </Paper>
        {selected && (
          <Paper sx={{ overflow: "auto", p: 2 }}>
            <Button onClick={() => setSelected(null)}>詳細を閉じる</Button>
            <MaterialDetail key={selected} number={selected} basePath="/pc" />
          </Paper>
        )}
      </Box>
    </Stack>
  );
}
