export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "same-origin",
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-SimpleMam-Request": "1",
      ...init?.headers,
    },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      response.status,
      typeof body.detail === "string" ? body.detail : "処理に失敗しました",
    );
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

export function queryString(values: Record<string, string | number | boolean>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    if (value !== "") params.set(key, String(value));
  return params.toString();
}

export function day(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function programUrl(base: string, id: number, date: string | null) {
  return `${base}/programs/${id}?on_air_date=${encodeURIComponent(date ?? "undated")}`;
}
