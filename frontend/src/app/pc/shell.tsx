"use client";
import { useSyncExternalStore } from "react";
import {
  Box,
  Divider,
  Drawer,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import ChevronLeft from "@mui/icons-material/ChevronLeft";
import Menu from "@mui/icons-material/Menu";
import SideMenu from "@/components/side-menu";
// localStorage is an external store. The server always renders the expanded drawer.
const key = "simplemam:menu-open";
let cached: boolean | undefined;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function snapshot() {
  if (cached === undefined) {
    try {
      cached = localStorage.getItem(key) !== "false";
    } catch {
      cached = true;
    }
  }
  return cached;
}
function toggle() {
  cached = !snapshot();
  try {
    localStorage.setItem(key, String(cached));
  } catch {
    /* Persistence is optional. */
  }
  listeners.forEach((listener) => listener());
}
export default function PcShell({ children }: { children: React.ReactNode }) {
  const open = useSyncExternalStore(subscribe, snapshot, () => true);
  const width = open ? 216 : 64;
  return (
    <Box sx={{ display: "flex", height: "100dvh", overflow: "hidden" }}>
      <Drawer
        variant="permanent"
        sx={{
          width,
          flexShrink: 0,
          "& .MuiDrawer-paper": {
            width,
            overflowX: "hidden",
            boxSizing: "border-box",
            transition: (theme) => theme.transitions.create("width"),
          },
        }}
      >
        <Stack
          direction="row"
          sx={{
            height: 56,
            px: 1,
            alignItems: "center",
            justifyContent: open ? "space-between" : "center",
          }}
        >
          {open && (
            <Typography variant="h6" sx={{ pl: 1 }}>
              SimpleMam
            </Typography>
          )}
          <IconButton
            onClick={toggle}
            aria-label={open ? "メニューを折りたたむ" : "メニューを展開する"}
            aria-expanded={open}
          >
            {open ? <ChevronLeft /> : <Menu />}
          </IconButton>
        </Stack>
        <Divider />
        <SideMenu basePath="/pc" collapsed={!open} />
      </Drawer>
      <Box
        component="main"
        sx={{ flex: 1, minWidth: 0, overflow: "auto", p: 2 }}
      >
        {children}
      </Box>
    </Box>
  );
}
