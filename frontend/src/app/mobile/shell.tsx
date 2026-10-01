"use client";
import { useState } from "react";
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  Toolbar,
  Typography,
} from "@mui/material";
import Menu from "@mui/icons-material/Menu";
import SideMenu from "@/components/side-menu";

export default function MobileShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Box>
      <AppBar position="sticky">
        <Toolbar variant="dense">
          <IconButton
            color="inherit"
            aria-label="メニューを開く"
            onClick={() => setOpen(true)}
          >
            <Menu />
          </IconButton>
          <Typography variant="h6">SimpleMam</Typography>
        </Toolbar>
      </AppBar>
      <Drawer variant="temporary" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 240 }}>
          <SideMenu basePath="/mobile" onNavigate={() => setOpen(false)} />
        </Box>
      </Drawer>
      <Box component="main" sx={{ p: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
