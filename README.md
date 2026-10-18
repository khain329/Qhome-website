# Qhome Staycation – website

Web tĩnh dựng bằng Python (`src/build.py`) ra thư mục `site/`, chạy trên Netlify, có trang quản trị tại `/admin`.

## Cấu trúc

| Thư mục / file | Vai trò |
|---|---|
| `src/` | Mã nguồn: `build.py` dựng trang, `content.py` dữ liệu chi nhánh, `main.js` + `*.css` giao diện |
| `site/` | Web hoàn chỉnh (Netlify phục vụ thư mục này). `site/assets/img/` chứa toàn bộ ảnh |
| `site/admin/` | Trang quản trị |
| `netlify/functions/` | API cho trang quản trị: lưu nội dung, tải ảnh, phục vụ ảnh |
| `plugins/qh-content/` | Trước mỗi lần dựng, lấy nội dung do /admin lưu về `src/content.json` |
| `netlify.toml` | Cấu hình Netlify |

## Cài đặt lần đầu

1. Đưa cả thư mục này lên một repo GitHub mới (ví dụ `qhome-website`).
2. Netlify → **Add new project → Import an existing project → GitHub** → chọn repo. Các ô build để nguyên (đã có trong `netlify.toml`) → Deploy.
3. **Project configuration → Identity → Enable Identity**. Ở *Registration* chọn **Invite only**. Bấm **Invite users** và nhập email quản trị.
4. **Project configuration → Build & deploy → Build hooks → Add build hook** (tên: `admin`, nhánh `main`). Sao chép đường dẫn.
5. **Project configuration → Environment variables → Add a variable**: key `QH_BUILD_HOOK`, value là đường dẫn vừa sao chép, scope có **Functions**.
6. Deploy lại một lần (Deploys → Trigger deploy) để biến môi trường có hiệu lực.
7. Mở email mời, bấm đường dẫn, đặt mật khẩu → vào được `https://<tên-web>.netlify.app/admin/`.

## Dùng thử trang quản trị không cần đăng nhập

Mở `/admin/?demo`. Thay đổi chỉ lưu trong trình duyệt, không lên web.

## Dựng thử trên máy

```bash
python3 src/build.py
cd site && python3 -m http.server 8000
```
