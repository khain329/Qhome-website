// /api/content — đọc (công khai) và lưu (cần đăng nhập) nội dung website.
import { getStore } from "@netlify/blobs"
import { getUser } from "@netlify/identity"
import type { Config } from "@netlify/functions"

const STORE = "qhome"
const KEY = "content"
const MAX_BYTES = 3_000_000

export default async (req: Request) => {
  const store = getStore({ name: STORE, consistency: "strong" })

  if (req.method === "GET") {
    const data = await store.get(KEY, { type: "json" })
    if (!data) return Response.json({ error: "empty" }, { status: 404, headers: { "cache-control": "no-store" } })
    return Response.json(data, { headers: { "cache-control": "no-store" } })
  }

  if (req.method === "PUT") {
    const user = await getUser()
    if (!user) return Response.json({ error: "Bạn cần đăng nhập lại." }, { status: 401 })

    const text = await req.text()
    if (text.length > MAX_BYTES) return Response.json({ error: "Nội dung quá lớn." }, { status: 413 })
    let body: any
    try { body = JSON.parse(text) } catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }) }
    if (!body || !Array.isArray(body.branches) || typeof body.pages !== "object") {
      return Response.json({ error: "Thiếu dữ liệu chi nhánh hoặc trang." }, { status: 400 })
    }

    // giữ 20 bản lưu gần nhất để có thể khôi phục
    const prev = await store.get(KEY, { type: "json" })
    if (prev) await store.setJSON(`history/${Date.now()}`, prev)
    const { blobs } = await store.list({ prefix: "history/" })
    const old = blobs.map(b => b.key).sort().slice(0, Math.max(0, blobs.length - 20))
    await Promise.all(old.map(k => store.delete(k)))

    const doc = { ...body, version: 1, updated: new Date().toISOString(), updatedBy: user.email }
    await store.setJSON(KEY, doc)

    // kích hoạt dựng lại website
    const hook = Netlify.env.get("QH_BUILD_HOOK")
    let building = false
    if (hook) {
      const r = await fetch(hook + (hook.includes("?") ? "&" : "?") + "trigger_title=" + encodeURIComponent("Cập nhật từ /admin bởi " + user.email), { method: "POST" })
      building = r.ok
    }
    return Response.json({ ok: true, updated: doc.updated, building, hook: Boolean(hook) })
  }

  return new Response("Method not allowed", { status: 405 })
}

export const config: Config = { path: "/api/content", method: ["GET", "PUT"] }
