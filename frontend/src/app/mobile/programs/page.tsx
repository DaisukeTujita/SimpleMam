"use client";
import { useState } from "react";
import Link from "next/link";
import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, day, programUrl, queryString } from "@/lib/api";
import type { Page, Program } from "@/lib/types";
export default function MobilePrograms() {
  const [date, setDate] = useState(() => day());
  const [name, setName] = useState("");
  const [undated, setUndated] = useState(false);
  const [page, setPage] = useState(1);
  const [criteria, setCriteria] = useState(() => ({
    date_from: day(),
    date_to: day(),
    name: "",
    include_undated: false,
  }));
  const query = useQuery({
    queryKey: ["programs", "mobile", criteria, page],
    queryFn: () =>
      api<Page<Program>>(
        `/programs?${queryString({ ...criteria, page, page_size: 30 })}`,
      ),
  });
  function chooseDate(offset: number) {
    const value = day(offset);
    setDate(value);
    setPage(1);
    setCriteria({
      date_from: value,
      date_to: value,
      name,
      include_undated: undated,
    });
  }
  return (
    <Stack spacing={2}>
      <Typography variant="h5">番組検索</Typography>
      <Stack direction="row" spacing={1}>
        <Button onClick={() => chooseDate(-1)}>前日 {day(-1).slice(5)}</Button>
        <Button onClick={() => chooseDate(0)}>本日 {day().slice(5)}</Button>
      </Stack>
      <Stack
        component="form"
        spacing={1}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setCriteria({
            date_from: date,
            date_to: date,
            name,
            include_undated: undated,
          });
        }}
      >
        <TextField
          label="放送日"
          type="date"
          value={date}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => setDate(e.target.value)}
        />
        <TextField
          label="番組名"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <FormControlLabel
          label="放送日未定を含む"
          control={
            <Checkbox
              checked={undated}
              onChange={(e) => setUndated(e.target.checked)}
            />
          }
        />
        <Button type="submit" variant="contained">
          検索
        </Button>
      </Stack>
      {query.isPending && <CircularProgress />}
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      {query.data?.items.map((program) => (
        <Card key={`${program.id}:${program.on_air_date}`}>
          <CardActionArea
            component={Link}
            href={programUrl("/mobile", program.id, program.on_air_date)}
          >
            <CardContent>
              <Typography color="text.secondary">
                {program.on_air_date ?? "放送日未定"}　{program.start_time} ～{" "}
                {program.end_time}
              </Typography>
              <Typography variant="h6">{program.name}</Typography>
              <Typography>
                {program.sub_control_room_name}／{program.group_id}
              </Typography>
            </CardContent>
          </CardActionArea>
        </Card>
      ))}
      {query.data?.total === 0 && (
        <Typography>条件に一致する番組はありません</Typography>
      )}
      <Stack
        direction="row"
        sx={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
          前へ
        </Button>
        <Typography>{page}</Typography>
        <Button
          disabled={page * 30 >= (query.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          次へ
        </Button>
      </Stack>
    </Stack>
  );
}
