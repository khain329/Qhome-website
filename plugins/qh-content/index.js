// Trước khi dựng: lấy nội dung do /admin lưu trong Netlify Blobs → src/content.json
// Chuyển web sang tài khoản/site Netlify khác: đặt biến QH_MIGRATE_FROM = địa chỉ web cũ (vd https://mottrainghiem.netlify.app).
// Lần dựng đầu tiên sẽ tự sao chép nội dung và ảnh đã tải lên từ web cũ (chỉ khi site mới chưa có nội dung).
import { getStore } from "@netlify/blobs"
import { writeFileSync, rmSync } from "node:fs"

async function migrate(from, store) {
  const base = from.replace(/\/+$/, "")
  const r = await fetch(base + "/api/content", { headers: { "cache-control": "no-cache" } })
  if (!r.ok) { console.log(`qh-content: không đọc được nội dung từ ${base} (HTTP ${r.status})`); return null }
  const data = await r.json()
  const media = getStore("qhome-media")
  const keys = [...new Set(JSON.stringify(data).match(/\/media\/[\w\-./]+?\.(?:webp|jpg|jpeg|png|avif)/g) || [])]
  let ok = 0
  for (const path of keys) {
    try {
      const res = await fetch(base + path)
      if (!res.ok) { console.log(`qh-content: bỏ qua ${path} (HTTP ${res.status})`); continue }
      const type = (res.headers.get("content-type") || "image/webp").split(";")[0]
      await media.set(path.replace(/^\/media\//, ""), await res.arrayBuffer(), { metadata: { type, migratedFrom: base, at: Date.now() } })
      ok++
    } catch (e) { console.log(`qh-content: lỗi tải ${path}: ${e.message}`) }
  }
  await store.setJSON("content", data)
  console.log(`qh-content: đã chuyển nội dung và ${ok}/${keys.length} ảnh từ ${base}`)
  return data
}

export const onPreBuild = async () => {
  const out = "src/content.json"
  try {
    let store, data
    try { store = getStore({ name: "qhome", consistency: "strong" }); data = await store.get("content", { type: "json" }) }
    catch { store = getStore("qhome"); data = await store.get("content", { type: "json" }) }
    const from = process.env.QH_MIGRATE_FROM
    if (!data && from) data = await migrate(from, store)
    if (data) {
      writeFileSync(out, JSON.stringify(data))
      console.log(`qh-content: đã lấy nội dung (cập nhật ${data.updated || "?"})`)
    } else {
      rmSync(out, { force: true })
      console.log("qh-content: chưa có nội dung từ /admin, dùng mặc định")
    }
  } catch (e) {
    console.log("qh-content: không đọc được Blobs, dùng mặc định:", e.message)
  }
}
