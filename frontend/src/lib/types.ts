export type User = {
  user_id: string;
  user_name: string;
  group_id: string;
  group_name: string;
  is_admin: boolean;
};
export type Group = { group_id: string; group_name: string };
export type Material = {
  id: string;
  number: string;
  title: string;
  material_type: string;
  status: string;
  category_code: string;
  genre_code: string;
  group_id: string;
  created_at: string | null;
  registration_route: string;
  duration: string;
  material_content: string;
  handover_note: string;
  edit_status: string;
  thumbnail_url: string;
  hls_url: string;
  can_edit: boolean;
};
export type MaterialValues = Pick<
  Material,
  | "title"
  | "category_code"
  | "genre_code"
  | "material_content"
  | "handover_note"
>;
export type Program = {
  id: number;
  name: string;
  on_air_date: string | null;
  start_time: string;
  end_time: string;
  group_id: string;
  category_code: string;
  genre_code: string;
  sub_control_room_id: number | null;
  sub_control_room_name: string;
  can_edit: boolean;
};
export type SmallBlock = {
  id: number;
  large_number: number;
  name: string;
  material_number: string;
  is_blank: boolean;
  sort_order: number;
};
export type LargeBlock = {
  number: number;
  name: string;
  display_number: string;
  sort_order: number;
  is_discarded: boolean;
  children: SmallBlock[];
};
export type Rundown = {
  program: Program;
  large_blocks: LargeBlock[];
  bucket: SmallBlock[];
};
export type Page<T> = {
  items: T[];
  total: number;
  status_counts?: Record<string, number>;
};
