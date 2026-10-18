// /api/upload — tải ảnh lên (cần đăng nhập). Trả về đường dẫn /media/<khoá>.
import { getStore } from "@netlify/blobs"
import { getUser } from "@netlify/identity"
import type { Config } from "@netlify/functions"

const TYPES: Record<string, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png", "image/avif": "avif" }

export default async (req: Request) => {
  const user = await getUser()
  if (!user) return Response.json({ error: "Bạn cần đăng nhập lại." }, { status: 401 })

  const type = (req.headers.get("content-type") || "").split(";")[0].trim()
  const ext = TYPES[type]
  if (!ext) return Response.json({ error: "Chỉ nhận ảnh WebP, JPG, PNG hoặc AVIF." }, { status: 415 })

  const buf = await req.arrayBuffer()
  if (buf.byteLength > 4_200_000) return Response.json({ error: "Ảnh quá lớn (tối đa khoảng 4MB)." }, { status: 413 })

  const key = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID().slice(0, 12)}.${ext}`
  await getStore("qhome-media").set(key, buf, { metadata: { type, by: user.email, at: Date.now() } })
  return Response.json({ src: `/media/${key}` })
}

export const config: Config = { path: "/api/upload", method: "POST" }
