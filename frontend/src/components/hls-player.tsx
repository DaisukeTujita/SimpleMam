"use client";
import { useEffect, useRef, useState } from "react";
import { Alert, Box } from "@mui/material";

export default function HlsPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let disposed = false;
    let player: import("hls.js").default | undefined;
    if (video.canPlayType("application/vnd.apple.mpegurl")) video.src = src;
    else
      void import("hls.js")
        .then(({ default: Hls }) => {
          if (disposed) return;
          if (!Hls.isSupported()) {
            setError("このブラウザーではHLSを再生できません");
            return;
          }
          player = new Hls();
          player.loadSource(src);
          player.attachMedia(video);
          player.on(Hls.Events.ERROR, (_, data) => {
            if (data.fatal)
              setError("HLSを読み込めません。ファイルの配置を確認してください");
          });
        })
        .catch(() => {
          if (!disposed) setError("プレイヤーを読み込めません");
        });
    return () => {
      disposed = true;
      player?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);
  return (
    <Box>
      <Box
        component="video"
        ref={videoRef}
        controls
        playsInline
        onError={() => setError("HLSを読み込めません")}
        sx={{ width: "100%", maxHeight: 320, bgcolor: "black" }}
      />
      {error && <Alert severity="warning">{error}</Alert>}
    </Box>
  );
}
