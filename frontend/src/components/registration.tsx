"use client";
import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  LinearProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";

export default function Registration({
  accept = "video/*,.mxf",
}: {
  accept?: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<XMLHttpRequest | null>(null);
  useEffect(
    () => () => {
      const xhr = request.current;
      if (xhr) {
        xhr.onload = xhr.onerror = xhr.onabort = null;
        xhr.abort();
      }
    },
    [],
  );
  function upload() {
    if (!file) return;
    const xhr = new XMLHttpRequest();
    request.current = xhr;
    xhr.open("POST", "/api/uploads");
    xhr.setRequestHeader("X-SimpleMam-Request", "1");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable)
        setProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      setBusy(false);
      request.current = null;
      if (xhr.status >= 200 && xhr.status < 300)
        setMessage("ファイルの受信が完了しました");
      else {
        try {
          setError(
            JSON.parse(xhr.responseText).detail ?? "アップロードに失敗しました",
          );
        } catch {
          setError("アップロードに失敗しました");
        }
      }
    };
    xhr.onerror = () => {
      setBusy(false);
      request.current = null;
      setError("通信に失敗しました。もう一度送信してください");
    };
    xhr.onabort = () => {
      setBusy(false);
      request.current = null;
      setError("送信を中止しました");
    };
    const form = new FormData();
    form.append("file", file);
    form.append("title", title);
    setMessage("");
    setError("");
    setProgress(0);
    setBusy(true);
    xhr.send(form);
  }
  return (
    <Paper sx={{ p: 3, maxWidth: 720 }}>
      <Stack spacing={2}>
        <Typography variant="h5">素材登録</Typography>
        <Typography>
          動画ファイルをアップロードフォルダーへ送信します。
        </Typography>
        <TextField
          label="タイトル（任意）"
          value={title}
          disabled={busy}
          slotProps={{ htmlInput: { maxLength: 128 } }}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button variant="outlined" component="label" disabled={busy}>
          ファイルを選択
          <input
            type="file"
            accept={accept}
            hidden
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setMessage("");
            }}
          />
        </Button>
        <Typography sx={{ overflowWrap: "anywhere" }}>
          {file
            ? `${file.name} (${(file.size / 1024 ** 2).toFixed(1)} MB)`
            : "未選択"}
        </Typography>
        {busy && (
          <>
            <LinearProgress variant="determinate" value={progress} />
            <Typography>
              {progress}%{" "}
              {progress === 100 ? "サーバーの保存完了を待っています" : ""}
            </Typography>
          </>
        )}
        <Stack direction="row" spacing={1}>
          <Button variant="contained" disabled={!file || busy} onClick={upload}>
            送信
          </Button>
          {busy && (
            <Button color="error" onClick={() => request.current?.abort()}>
              中止
            </Button>
          )}
        </Stack>
        {message && <Alert severity="success">{message}</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
      </Stack>
    </Paper>
  );
}
