"use client";
import { useState } from "react";
import { Box, Typography } from "@mui/material";
export default function Thumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <Box
      sx={{
        aspectRatio: "16/9",
        display: "grid",
        placeItems: "center",
        bgcolor: "action.hover",
      }}
    >
      <Typography color="text.secondary">No Image</Typography>
    </Box>
  ) : (
    // Media is served directly from the configured share, without Next image optimization.
    <Box
      component="img"
      src={src}
      alt="素材サムネイル"
      loading="lazy"
      onError={() => setFailed(true)}
      sx={{
        width: "100%",
        aspectRatio: "16/9",
        objectFit: "contain",
        bgcolor: "black",
      }}
    />
  );
}
