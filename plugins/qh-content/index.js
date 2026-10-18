// Trước khi dựng: lấy nội dung do /admin lưu trong Netlify Blobs → src/content.json
import { getStore } from "@netlify/blobs"
import { writeFileSync, rmSync } from "node:fs"

export const onPreBuild = async ({ utils }) => {
  const out = "src/content.json"
  try {
    let data
    try { data = await getStore({ name: "qhome", consistency: "strong" }).get("content", { type: "json" }) }
    catch { data = await getStore("qhome").get("content", { type: "json" }) }
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
