"use client";
import { createTheme } from "@mui/material/styles";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#4dd0e1" },
    background: { default: "#101820", paper: "#18232d" },
  },
  typography: {
    fontFamily: '"Segoe UI", "Yu Gothic UI", "Meiryo", sans-serif',
    fontSize: 14,
  },
  components: {
    MuiButton: { defaultProps: { size: "small" } },
    MuiTextField: { defaultProps: { size: "small" } },
    MuiTable: { defaultProps: { size: "small" } },
    MuiButtonBase: { defaultProps: { disableRipple: false } },
  },
});
