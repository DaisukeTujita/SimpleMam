"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Tooltip,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import UploadIcon from "@mui/icons-material/Upload";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PersonIcon from "@mui/icons-material/Person";

// Add one entry here and one page under app/pc (and app/mobile, when needed).
const items = [
  { label: "素材検索", path: "/materials", Icon: SearchIcon },
  { label: "素材登録", path: "/register", Icon: UploadIcon },
  { label: "番組検索", path: "/programs", Icon: ListAltIcon },
  { label: "ユーザー情報", path: "/user", Icon: PersonIcon },
];

export default function SideMenu({
  basePath,
  collapsed = false,
  onNavigate,
}: {
  basePath: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <List>
      {items.map(({ label, path, Icon }) => {
        const href = basePath + path;
        const selected = pathname === href || pathname.startsWith(href + "/");
        return (
          <Tooltip key={path} title={collapsed ? label : ""} placement="right">
            <ListItemButton
              component={Link}
              href={href}
              selected={selected}
              aria-label={label}
              aria-current={selected ? "page" : undefined}
              onClick={onNavigate}
              sx={{
                minHeight: 48,
                justifyContent: collapsed ? "center" : "initial",
                px: 2,
              }}
            >
              <ListItemIcon sx={{ minWidth: collapsed ? 0 : 40 }}>
                <Icon />
              </ListItemIcon>
              {!collapsed && <ListItemText primary={label} />}
            </ListItemButton>
          </Tooltip>
        );
      })}
    </List>
  );
}
