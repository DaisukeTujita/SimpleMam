"use client";
import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { api, day, queryString } from "@/lib/api";
import type { Material, Page } from "@/lib/types";
import Thumbnail from "@/components/thumbnail";
import MaterialDetail from "@/components/material-detail";
export default function MobileMaterials() {
  const [date, setDate] = useState(() => day());
  const [title, setTitle] = useState("");
  const [criteria, setCriteria] = useState(() => ({
    created_from: day(),
    created_to: day(),
    title: "",
  }));
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ["materials", "mobile", criteria, page],
    queryFn: () =>
      api<Page<Material>>(
        `/materials?${queryString({ ...criteria, page, page_size: 30 })}`,
      ),
  });
  function chooseDate(offset: number) {
    const value = day(offset);
    setDate(value);
    setPage(1);
    setCriteria({ created_from: value, created_to: value, title });
  }
  return (
    <Stack spacing={1}>
      <Typography variant="h5">素材検索</Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant={date === day(-1) ? "contained" : "outlined"}
          onClick={() => chooseDate(-1)}
        >
          前日 {day(-1).slice(5)}
        </Button>
        <Button
          variant={date === day() ? "contained" : "outlined"}
          onClick={() => chooseDate(0)}
        >
          本日 {day().slice(5)}
        </Button>
      </Stack>
      <Stack
        component="form"
        spacing={1}
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setCriteria({ created_from: date, created_to: date, title });
        }}
      >
        <TextField
          label="作成日"
          type="date"
          slotProps={{ inputLabel: { shrink: true } }}
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
        <TextField
          label="タイトル"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" variant="contained">
          検索
        </Button>
      </Stack>
      {query.isPending && <CircularProgress />}
      {query.error && <Alert severity="error">{query.error.message}</Alert>}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(2,minmax(0,1fr))",
          gap: 1,
        }}
      >
        {query.data?.items.map((material) => (
          <Card key={material.number}>
            <CardActionArea onClick={() => setSelected(material.number)}>
              <Thumbnail
                key={material.thumbnail_url}
                src={material.thumbnail_url}
              />
              <CardContent sx={{ p: 1 }}>
                <Typography noWrap title={material.number}>
                  {material.number}
                </Typography>
                <Typography noWrap>{material.title}</Typography>
                <Typography variant="caption">
                  {material.material_type}
                </Typography>
                <Chip size="small" label={material.status} />
              </CardContent>
            </CardActionArea>
          </Card>
        ))}
      </Box>
      {query.data?.total === 0 && (
        <Typography>条件に一致する素材はありません</Typography>
      )}
      <Stack
        direction="row"
        sx={{ alignItems: "center", justifyContent: "space-between" }}
      >
        <Button disabled={page === 1} onClick={() => setPage(page - 1)}>
          前へ
        </Button>
        <Typography>
          {page}／{Math.max(1, Math.ceil((query.data?.total ?? 0) / 30))}
        </Typography>
        <Button
          disabled={page * 30 >= (query.data?.total ?? 0)}
          onClick={() => setPage(page + 1)}
        >
          次へ
        </Button>
      </Stack>
      <Dialog
        fullScreen
        open={selected !== null}
        onClose={() => setSelected(null)}
      >
        <DialogTitle>
          <Button onClick={() => setSelected(null)}>閉じる</Button>
        </DialogTitle>
        <DialogContent>
          {selected && (
            <MaterialDetail
              key={selected}
              number={selected}
              basePath="/mobile"
            />
          )}
        </DialogContent>
      </Dialog>
    </Stack>
  );
}
