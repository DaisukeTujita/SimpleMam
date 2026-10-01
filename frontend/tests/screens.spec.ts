import { test, expect, type Page } from "@playwright/test";

// Test-only HTTP fixtures. No fixture API or database is shipped in the application.
const user = {
  user_id: "u1",
  user_name: "利用者",
  group_id: "g1",
  group_name: "報道",
  is_admin: false,
};
const original = {
  id: "string-id",
  number: "MAT-001-LONG-NUMBER",
  title: "テスト素材",
  material_type: "元素材",
  status: "登録完了",
  category_code: "01",
  genre_code: "02",
  group_id: "g1",
  created_at: "2026-10-02T08:00:00",
  registration_route: "FTP",
  duration: "00:00:10:00",
  material_content: "内容",
  handover_note: "メモ",
  edit_status: "",
  thumbnail_url: "/media/thumbnails/MAT-001/thumbnail.jpg",
  hls_url: "/media/hls/MAT-001/index.m3u8",
  can_edit: true,
};
const program = {
  id: 42,
  name: "朝のニュース",
  on_air_date: "2026-10-02",
  start_time: "08:00:00",
  end_time: "08:30:00",
  group_id: "g1",
  category_code: "01",
  genre_code: "01",
  sub_control_room_id: 1,
  sub_control_room_name: "第1サブ",
  can_edit: true,
};

async function mockApi(page: Page, loggedIn = true) {
  let authenticated = loggedIn;
  let groupSelected = loggedIn;
  let material = { ...original };
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    let body: unknown;
    let status = 200;
    if (path === "/api/auth/login") {
      authenticated = true;
      body = { ok: true };
    } else if (path === "/api/auth/select-group") {
      groupSelected = true;
      body = { ok: true };
    } else if (path === "/api/auth/groups")
      body = [{ group_id: "g1", group_name: "報道" }];
    else if (path === "/api/auth/me") {
      status = !authenticated ? 401 : !groupSelected ? 403 : 200;
      body =
        status === 200
          ? user
          : {
              detail:
                status === 401
                  ? "ログインしてください"
                  : "グループを選択してください",
            };
    } else if (path === "/api/materials")
      body = { items: [material], total: 1, status_counts: { 登録完了: 1 } };
    else if (path.endsWith("/usages")) body = [];
    else if (path.startsWith("/api/materials/")) {
      if (request.method() === "PATCH")
        material = { ...material, ...request.postDataJSON().values };
      body = material;
    } else if (path === "/api/programs") body = { items: [program], total: 1 };
    else if (path === "/api/sub-control-rooms")
      body = [{ id: 1, name: "第1サブ" }];
    else if (path.endsWith("/rundown"))
      body = {
        program,
        large_blocks: [
          {
            number: 1,
            name: "ニュース",
            display_number: "001",
            sort_order: 1,
            is_discarded: false,
            children: [
              {
                id: 1,
                large_number: 1,
                name: "トップ",
                material_number: original.number,
                is_blank: false,
                sort_order: 1,
              },
            ],
          },
        ],
        bucket: [],
      };
    else {
      status = 404;
      body = { detail: "Not found" };
    }
    await route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
  await page.route("**/media/**", (route) =>
    route.fulfill({ status: 404, body: "" }),
  );
}

test("login then group selection opens PC material search", async ({
  page,
}) => {
  await mockApi(page, false);
  await page.goto("/pc/materials");
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("ユーザーID").fill("u1");
  await page.getByLabel("パスワード").fill("password");
  await page.getByRole("button", { name: "ログイン", exact: true }).click();
  await page.getByRole("button", { name: "報道", exact: true }).click();
  await expect(page.getByRole("heading", { name: "素材検索" })).toBeVisible();
});

test("PC drawer collapse survives navigation and reload; menu stays flat", async ({
  page,
}) => {
  await mockApi(page);
  await page.goto("/pc/materials");
  await page.getByRole("button", { name: "メニューを折りたたむ" }).click();
  await page.getByRole("link", { name: "番組検索", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "メニューを展開する" }),
  ).toBeVisible();
  await page.getByText("朝のニュース", { exact: true }).click();
  await page.getByRole("link", { name: "詳細を開く" }).click();
  await expect(page).toHaveURL(/programs\/42\?on_air_date=2026-10-02/);
  await expect(
    page.getByRole("link", { name: "番組検索", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: /朝のニュース/ })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "メニューを展開する" }),
  ).toBeVisible();
});

test("material detail editing uses number without sub-number", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockApi(page);
  await page.goto("/pc/materials");
  await page.getByText(original.number, { exact: true }).click();
  await page.getByRole("button", { name: "編集", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("タイトル", { exact: true }).fill("編集後の素材");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("heading", { name: "編集後の素材" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile has its own drawer and two-column cards", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockApi(page);
  await page.goto("/mobile/materials");
  await expect(page.getByRole("heading", { name: "素材検索" })).toBeVisible();
  await page.getByRole("button", { name: "メニューを開く" }).click();
  await page.getByRole("link", { name: "番組検索", exact: true }).click();
  await expect(page).toHaveURL(/\/mobile\/programs$/);
  await expect(page.getByRole("link", { name: /朝のニュース/ })).toBeVisible();
});
