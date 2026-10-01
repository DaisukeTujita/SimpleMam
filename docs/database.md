# SQL Serverの必要テーブル・列

SQLは `backend/app/services/` に直接記述します。以下は参照元OpenMamの `basic_sqlserver` の定義を基準にしています。
別DBに接続する場合は、このSQLを直接変更してください。マッピング設定や生成アダプターはありません。

| テーブル | 使用する列 |
|---|---|
| `T_MATERIALS` | material_id, material_type, category_code, genre_code, group_id, is_deleted |
| `T_MATERIAL_VERSIONS` | material_id, material_number, material_title, registration_status, created_at, registration_path, on_air_duration, material_content, handover_note, edit_status |
| `T_PROGRAMS` | program_id, program_data_type, program_name, on_air_date, program_start_time, program_end_time, category_code, genre_code, group_id, sub_control_room_id |
| `M_SUB_CONTROL_ROOMS` | sub_control_room_id, sub_control_room_name |
| `T_RUNDOWN_LARGE_BLOCKS` | program_id, large_block_number, large_block_category, large_block_type, is_discarded, sort_order, large_block_name, display_number |
| `T_RUNDOWN_SMALL_BLOCKS` | small_block_id, program_id, large_block_number, sort_order, small_block_name, material_id, active_material_number, is_blank, is_deleted |
| `T_USERS` | user_id, first_name, last_name |
| `T_PASSWORDS` | user_id, password |
| `T_GROUPS` | group_id, group_name, authority_flag |
| `T_USERS_GROUPS` | user_id, group_id |

コード：素材種別1=元素材、2=OA素材。登録状態1/NULL=未登録、2=登録中、3=登録完了、8=キャンセル、9=エラー。
番組の `program_data_type=2`（運行表）だけを扱います。小項目の `large_block_number=0` は未配置です。
大項目追加時は `large_block_category=1`、`large_block_type=1` とします。
保存しない列の既定値やNOT NULL制約は、実DBの定義と照合してください。SimpleMamによるDDLはありません。
