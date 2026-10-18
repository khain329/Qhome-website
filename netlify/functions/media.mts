// /media/* — phục vụ ảnh đã tải lên từ trang quản trị.
import { getStore } from "@netlify/blobs"
import type { Config, Context } from "@netlify/functions"

export default async (req: Request, context: Context) => {
  const key = new URL(req.url).pathname.replace(/^\/media\//, "")
  if (!key || key.includes("..")) return new Response("Not found", { status: 404 })
  const res = await getStore("qhome-media").getWithMetadata(key, { type: "arrayBuffer" })
  if (!res) return new Response("Not found", { status: 404 })
  const type = (res.metadata && (res.metadata as any).type) || "application/octet-stream"
  return new Response(res.data as ArrayBuffer, {
    headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" },
  })
}

export const config: Config = { path: "/media/*", method: "GET" }
