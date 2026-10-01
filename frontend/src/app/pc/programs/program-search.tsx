"use client";
import { useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
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
  Typography,
} from "@mui/material";
import ExpandMore from "@mui/icons-material/ExpandMore";
import { useQuery } from "@tanstack/react-query";
import { api, day, queryString } from "@/lib/api";
import type { Page, Program } from "@/lib/types";
import Rundown from "@/components/rundown";
const initial = () => ({
  date_from: day(),
  date_to: day(),
  name: "",
  category_code: "",
  genre_code: "",
  room: "",
  group: "",
  include_undated: false,
});
export default function ProgramSearch() {
  const [draft, setDraft] = useState(initial);
  const [criteria, setCriteria] = useState(initial);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Program | null>(null);
  const programs = useQuery({
    queryKey: ["programs", criteria, page, pageSize],
    queryFn: () =>
      api<Page<Program>>(
        `/programs?${queryString({ ...criteria, page: page + 1, page_size: pageSize })}`,
      ),
  });
  const rooms = useQuery({
    queryKey: ["rooms"],
    queryFn: () =>
      api<
        {
          id: number;
          name: string;
        }[]
      >("/sub-control-rooms"),
  });
  function search(next = draft) {
    setCriteria({ ...next });
    setPage(0);
    setSelected(null);
  }
  function date(offset: number) {
    const next = { ...draft, date_from: day(offset), date_to: day(offset) };
    setDraft(next);
    search(next);
  }
  return (
    <Stack spacing={2} sx={{ height: "100%", minHeight: 0 }}>
      <Typography variant="h5">番組検索</Typography>
      <Accordion defaultExpanded disableGutters>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Typography>
            検索条件　{criteria.date_from || "指定なし"} ～{" "}
            {criteria.date_to || "指定なし"}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack
            component="form"
            spacing={2}
            onSubmit={(e) => {
              e.preventDefault();
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
                label="放送日・開始"
                type="date"
                value={draft.date_from}
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(e) =>
                  setDraft({ ...draft, date_from: e.target.value })
                }
              />
              <TextField
                label="放送日・終了"
                type="date"
                value={draft.date_to}
                slotProps={{ inputLabel: { shrink: true } }}
                onChange={(e) =>
                  setDraft({ ...draft, date_to: e.target.value })
                }
              />
              <Button onClick={() => date(-1)}>前日</Button>
              <Button onClick={() => date(0)}>本日</Button>
              <FormControlLabel
                label="放送日未定を含む"
                control={
                  <Checkbox
                    checked={draft.include_undated}
                    onChange={(e) =>
                      setDraft({ ...draft, include_undated: e.target.checked })
                    }
                  />
                }
              ></FormControlLabel>
            </Stack>
            <Stack
              direction="row"
              spacing={1}
              useFlexGap
              sx={{ flexWrap: "wrap" }}
            >
              {(
                [
                  ["name", "番組名"],
                  ["category_code", "カテゴリ"],
                  ["genre_code", "ジャンル"],
                  ["group", "グループ"],
                ] as const
              ).map(([key, label]) => (
                <TextField
                  key={key}
                  label={label}
                  value={draft[key]}
                  onChange={(e) =>
                    setDraft({ ...draft, [key]: e.target.value })
                  }
                />
              ))}
              <TextField
                select
                label="サブ"
                value={draft.room}
                sx={{ minWidth: 140 }}
                onChange={(e) => setDraft({ ...draft, room: e.target.value })}
              >
                <MenuItem value="">すべて</MenuItem>
                {rooms.data?.map((room) => (
                  <MenuItem value={room.id} key={room.id}>
                    {room.name}
                  </MenuItem>
                ))}
              </TextField>
              <Button type="submit" variant="contained">
                検索
              </Button>
            </Stack>
          </Stack>
        </AccordionDetails>
      </Accordion>
      {programs.error && (
        <Alert severity="error">{programs.error.message}</Alert>
      )}
      {rooms.error && (
        <Alert severity="warning">
          サブ一覧を取得できません：{rooms.error.message}
        </Alert>
      )}
      {programs.isPending && <CircularProgress />}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "minmax(280px,1fr) minmax(0,2fr)",
          flex: 1,
          minHeight: 200,
          gap: 2,
        }}
      >
        <Paper
          sx={{
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <TableContainer sx={{ flex: 1 }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {["放送時間", "番組名", "サブ", "グループ"].map((label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {programs.data?.items.map((program) => (
                  <TableRow
                    key={`${program.id}:${program.on_air_date}`}
                    hover
                    selected={
                      selected?.id === program.id &&
                      selected?.on_air_date === program.on_air_date
                    }
                    onClick={() => setSelected(program)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell sx={{ whiteSpace: "nowrap" }}>
                      {program.on_air_date ?? "放送日未定"}
                      <br />
                      {program.start_time}
                    </TableCell>
                    <TableCell>{program.name}</TableCell>
                    <TableCell>{program.sub_control_room_name}</TableCell>
                    <TableCell>{program.group_id}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {programs.data?.items.length === 0 && (
            <Typography sx={{ p: 2 }}>
              条件に一致する番組はありません
            </Typography>
          )}
          <TablePagination
            component="div"
            count={programs.data?.total ?? 0}
            page={page}
            rowsPerPage={pageSize}
            rowsPerPageOptions={[25, 50, 100]}
            onPageChange={(_, p) => {
              setPage(p);
              setSelected(null);
            }}
            labelRowsPerPage="表示件数"
            onRowsPerPageChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
              setSelected(null);
            }}
          />
        </Paper>
        <Paper sx={{ overflow: "auto", p: 2 }}>
          {selected ? (
            <Rundown
              key={`${selected.id}:${selected.on_air_date}`}
              id={selected.id}
              date={selected.on_air_date}
              basePath="/pc"
              preview
            />
          ) : (
            <Typography color="text.secondary">
              左の番組を選択すると運行表を表示します
            </Typography>
          )}
        </Paper>
      </Box>
    </Stack>
  );
}
