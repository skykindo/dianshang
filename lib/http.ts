export type ParsedJson<T> =
  | { ok: true; value: T }
  | { ok: false; response: Response };

export async function parseJsonBody<T>(request: Request): Promise<ParsedJson<T>> {
  try {
    return { ok: true, value: await request.json() as T };
  } catch {
    return {
      ok: false,
      response: Response.json(
        { error: { code: "INVALID_JSON", message: "请求体必须是有效 JSON。" } },
        { status: 400 },
      ),
    };
  }
}
