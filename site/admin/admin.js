/* Qhome Admin — trang quản trị nội dung.
   Dữ liệu: content = { branches: [...], pages: { <trang>: { img: {key: {h,src,x,y,z}}, txt: {key: {h,v}} } } }
   Chế độ thử: thêm ?demo vào địa chỉ để dùng không cần đăng nhập (lưu trong trình duyệt). */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const DEMO = /[?&]demo\b/.test(location.search);
const TIERS = ['Standard', 'Deluxe', 'Premium', 'Suite'];
const PRICE_COLS = ['Combo 2H', 'Combo 3H', 'Giờ tiếp theo', 'Qua đêm', 'Phòng ngày'];
const clone = o => JSON.parse(JSON.stringify(o));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SITE = new URL('../', location.href).href;
const absUrl = src => { if (!src) return ''; if (/^(https?:|data:|blob:)/.test(src)) return src; return src.startsWith('/') ? new URL(src, location.origin).href : new URL(src, SITE).href; };

const relSrc = src => (src && src.startsWith(location.origin + '/')) ? src.slice(location.origin.length) : src;
let ID = null;                  // @netlify/identity
const S = { user: null, content: null, published: '', pages: [], view: null, slots: {}, dev: innerWidth < 861 ? 'phone' : 'desktop', filter: 'all', q: '' };

/* ---------------- tiện ích giao diện ---------------- */
let toastT;
function toast(msg, err) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), err ? 5200 : 2800); }
function busy(on, msg) { $('#busy').hidden = !on; if (msg) $('#busyMsg').textContent = msg; }
function setStatus(s, text) { const el = $('#status'); el.dataset.s = s; el.textContent = text; }
function markDirty() {
  const now = JSON.stringify(S.content);
  const dirty = now !== S.published;
  setStatus(dirty ? 'dirty' : 'clean', dirty ? 'Có thay đổi chưa xuất bản' : 'Đã xuất bản');
  try { if (dirty) localStorage.setItem(draftKey(), JSON.stringify({ at: Date.now(), base: S.content.updated || null, content: S.content })); else localStorage.removeItem(draftKey()); } catch (e) {}
}
const draftKey = () => 'qh-admin-draft' + (DEMO ? '-demo' : '');
function imgBox(el, e, fallback) {
  const src = (e && e.src) || fallback || '';
  const x = e && e.x != null ? e.x : 50, y = e && e.y != null ? e.y : 50, z = (e && +e.z) || 1;
  el.style.backgroundImage = src ? `url("${absUrl(src)}")` : 'none';
  el.style.backgroundPosition = `${x}% ${y}%`;
  el.style.transform = z !== 1 ? `scale(${z})` : '';
  el.style.transformOrigin = `${x}% ${y}%`;
}

/* ---------------- xử lý ảnh: thu nhỏ trước khi tải lên ---------------- */
function readImage(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file); const im = new Image();
    im.onload = () => res({ im, url }); im.onerror = () => rej(new Error('Không đọc được ảnh này.')); im.src = url;
  });
}
async function prepareImage(file, max = 2000) {
  const { im, url } = await readImage(file);
  const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
  const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
  c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  const toBlob = (type, q) => new Promise(r => c.toBlob(r, type, q));
  let blob = await toBlob('image/webp', .84);
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', .86);
  return { blob, ar: c.width / c.height };
}
async function uploadImage(file) {
  busy(true, 'Đang xử lý và tải ảnh lên…');
  try {
    const { blob, ar } = await prepareImage(file);
    if (DEMO) { const src = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); }); return { src, ar }; }
    const r = await fetch('/api/upload', { method: 'POST', body: blob, headers: { 'content-type': blob.type }, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || 'Tải ảnh lên không thành công.');
    return { src: j.src, ar };
  } finally { busy(false); }
}

/* ---------------- khung cắt ảnh ---------------- */
const CROP = { src: '', x: 50, y: 50, z: 1, ar: 1.33, arM: null, iw: 0, ih: 0, onApply: null, upAr: null };
function cropGeom() {
  const { iw, ih, ar, z } = CROP; if (!iw) return null;
  let fw = 1, fh = 1;
  if (iw / ih > ar) fw = (ih * ar) / iw; else fh = (iw / ar) / ih;
  fw /= z; fh /= z;
  return { fw, fh, left: CROP.x / 100 * (1 - fw), top: CROP.y / 100 * (1 - fh) };
}
function cropRender() {
  const g = cropGeom(); if (!g) return;
  const fr = $('#cropFrame'), img = $('#cropImg');
  fr.style.left = (g.left * img.clientWidth) + 'px'; fr.style.top = (g.top * img.clientHeight) + 'px';
  fr.style.width = (g.fw * img.clientWidth) + 'px'; fr.style.height = (g.fh * img.clientHeight) + 'px';
  $('#cropZv').textContent = Math.round(CROP.z * 100) + '%';
  const e = { src: CROP.src, x: CROP.x, y: CROP.y, z: CROP.z };
  imgBox($('#pvDesk .pv-img'), e); imgBox($('#pvPhone .pv-img'), e);
  const tight = g.fw > .995 && g.fh > .995;
  $('#cropHint').textContent = tight ? 'Ảnh đang vừa khít khung. Kéo thanh Thu phóng để có khoảng di chuyển.' : 'Kéo khung để chọn phần ảnh hiển thị. Kéo thanh bên dưới để phóng to.';
}
function openCrop({ title, entry, fallback, ar, arM, onApply }) {
  Object.assign(CROP, { src: (entry && entry.src) || fallback || '', x: entry?.x ?? 50, y: entry?.y ?? 50, z: +(entry?.z) || 1, ar: ar || 1.33, arM: arM || null, onApply, upAr: null, iw: 0, ih: 0 });
  $('#cropT').textContent = title || 'Ảnh';
  $('#pvDesk').style.aspectRatio = String(CROP.ar);
  $('#pvPhoneWrap').hidden = !CROP.arM; if (CROP.arM) $('#pvPhone').style.aspectRatio = String(CROP.arM);
  $('#cropZoom').value = CROP.z;
  loadCropImage();
  $('#crop').hidden = false;
}
function loadCropImage() {
  const img = $('#cropImg');
  img.onload = () => { CROP.iw = img.naturalWidth; CROP.ih = img.naturalHeight; requestAnimationFrame(cropRender); };
  img.src = absUrl(CROP.src);
}
function initCrop() {
  const fr = $('#cropFrame'), img = $('#cropImg');
  let d = null;
  fr.addEventListener('pointerdown', e => { const g = cropGeom(); if (!g) return; d = { x: e.clientX, y: e.clientY, l: g.left, t: g.top, g }; fr.setPointerCapture(e.pointerId); e.preventDefault(); });
  fr.addEventListener('pointermove', e => {
    if (!d) return; const { g } = d;
    const l = Math.min(1 - g.fw, Math.max(0, d.l + (e.clientX - d.x) / img.clientWidth));
    const t = Math.min(1 - g.fh, Math.max(0, d.t + (e.clientY - d.y) / img.clientHeight));
    if (1 - g.fw > 1e-4) CROP.x = +(l / (1 - g.fw) * 100).toFixed(1);
    if (1 - g.fh > 1e-4) CROP.y = +(t / (1 - g.fh) * 100).toFixed(1);
    cropRender();
  });
  const end = () => { d = null; };
  fr.addEventListener('pointerup', end); fr.addEventListener('pointercancel', end);
  $('#cropStage').addEventListener('wheel', e => { e.preventDefault(); CROP.z = Math.min(3, Math.max(1, CROP.z - e.deltaY * .0015)); $('#cropZoom').value = CROP.z; cropRender(); }, { passive: false });
  $('#cropZoom').addEventListener('input', e => { CROP.z = +e.target.value; cropRender(); });
  $('#cropCenter').addEventListener('click', () => { CROP.x = 50; CROP.y = 50; cropRender(); });
  $('#cropFile').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { const up = await uploadImage(f); CROP.src = up.src; CROP.upAr = up.ar; CROP.x = 50; CROP.y = 50; CROP.z = 1; $('#cropZoom').value = 1; loadCropImage(); toast('Đã tải ảnh mới. Căn khung rồi bấm Áp dụng.'); }
    catch (err) { toast(err.message, true); }
  });
  $('#cropApply').addEventListener('click', () => { const e = { src: CROP.src, x: CROP.x, y: CROP.y, z: +CROP.z.toFixed(2) }; $('#crop').hidden = true; CROP.onApply && CROP.onApply(e, CROP.upAr); });
  $$('#crop [data-close]').forEach(b => b.addEventListener('click', () => { $('#crop').hidden = true; }));
  addEventListener('resize', () => { if (!$('#crop').hidden) cropRender(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#crop').hidden) $('#crop').hidden = true; });
}
async function pickAndCrop(opts) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const up = await uploadImage(f); openCrop(Object.assign({}, opts, { entry: { src: up.src, x: 50, y: 50, z: 1 }, onApply: (e) => opts.onApply(e, up.ar) })); } catch (err) { toast(err.message, true); } };
  inp.click();
}

/* ---------------- chuyển đổi chữ ↔ HTML ---------------- */
function toPlain(html) {
  const d = document.createElement('div'); d.innerHTML = html;
  $$('svg, i.dot', d).forEach(n => n.remove());
  const lines = $$('.line', d);
  const walk = n => [...n.childNodes].map(c => c.nodeType === 3 ? c.textContent : (c.tagName === 'BR' ? '\n' : (/^(EM|I)$/.test(c.tagName) || c.classList.contains('ital')) ? '*' + walk(c) + '*' : walk(c))).join('');
  if (lines.length) return lines.map(l => walk(l).trim()).join('\n');
  return walk(d).replace(/[ \t]+\n/g, '\n').trim();
}
function fromPlain(text, def) {
  const d = document.createElement('div'); d.innerHTML = def;
  const decorStart = [...d.childNodes].filter((c, i) => i === 0 && c.nodeType === 1 && (c.tagName === 'I' || c.tagName === 'svg')).map(c => c.outerHTML).join('');
  const svgs = $$(':scope > svg', d).map(s => s.outerHTML).join('');
  const italTag = /class="ital"/.test(def) ? ['<span class="ital">', '</span>'] : ['<em>', '</em>'];
  const inline = s => esc(s).replace(/\*([^*]+)\*/g, italTag[0] + '$1' + italTag[1]);
  if (/class="line"/.test(def)) return text.split('\n').filter(l => l.trim()).map(l => `<span class="line"><span>${inline(l.trim())}</span></span>`).join('\n          ');
  return decorStart + inline(text).replace(/\n/g, '<br>') + (svgs ? ' ' + svgs : '');
}

/* ---------------- dữ liệu ---------------- */
async function loadContent() {
  let c = null;
  if (DEMO) { try { c = JSON.parse(localStorage.getItem('qh-demo-content') || 'null'); } catch (e) {} }
  else { const r = await fetch('/api/content', { cache: 'no-store' }).catch(() => null); if (r && r.ok) c = await r.json(); }
  if (!c) { const r = await fetch('content.json', { cache: 'no-store' }); c = await r.json(); }
  c.pages = c.pages || {}; c.branches = c.branches || [];
  S.published = JSON.stringify(c);
  S.content = c;
  try {
    const dr = JSON.parse(localStorage.getItem(draftKey()) || 'null');
    if (dr && dr.content && JSON.stringify(dr.content) !== S.published && (dr.base || null) === (c.updated || null)) {
      S.content = dr.content; S.draftRestored = dr.at;
    }
  } catch (e) {}
  S.pages = await fetch('pages.json', { cache: 'no-store' }).then(r => r.json());
}
async function publish() {
  const btn = $('#publish'); btn.disabled = true; setStatus('busy', 'Đang xuất bản…');
  try {
    const body = JSON.stringify(S.content);
    if (DEMO) { localStorage.setItem('qh-demo-content', body); S.published = body; markDirty(); toast('Đã lưu (chế độ thử, chỉ trong trình duyệt này).'); return; }
    const r = await fetch('/api/content', { method: 'PUT', body, headers: { 'content-type': 'application/json' }, credentials: 'same-origin' });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { setStatus('err', 'Phiên đăng nhập hết hạn'); toast('Phiên đăng nhập đã hết hạn. Đăng nhập lại rồi bấm Xuất bản.', true); return; }
    if (!r.ok) throw new Error(j.error || 'Không lưu được.');
    S.content.updated = j.updated; S.published = JSON.stringify(S.content); markDirty();
    toast(j.building ? 'Đã xuất bản. Web sẽ cập nhật sau khoảng 1–2 phút.' : 'Đã lưu nội dung. Chưa cài Build hook nên web chưa tự cập nhật (xem Hướng dẫn).', !j.building);
  } catch (e) { setStatus('err', 'Xuất bản lỗi'); toast(e.message, true); }
  finally { btn.disabled = false; }
}

/* ---------------- menu ---------------- */
function renderSide() {
  const v = S.view || {};
  const pg = S.pages.map(p => `<button class="nav-i" data-go="page:${p.key}" aria-current="${v.type === 'page' && v.key === p.key}"><svg><use href="#${p.branch == null ? 'i-home' : 'i-pin'}"/></svg>${esc(p.name)}</button>`).join('');
  const br = S.content.branches.map((b, i) => `<button class="nav-i" data-go="branch:${i}" aria-current="${v.type === 'branch' && v.index === i}"><span class="dot" style="--d:${esc(b.color)}"></span>${esc(b.name)}<span class="n">${b.soon ? 'Sắp mở' : (b.rooms || []).length + ' phòng'}</span></button>`).join('');
  $('#side').innerHTML = `<h3>Ảnh &amp; chữ trên trang</h3>${pg}<h3>Chi nhánh, giá &amp; phòng</h3>${br}<button class="nav-i add" data-go="addbranch"><svg><use href="#i-plus"/></svg>Thêm chi nhánh</button><h3>Trợ giúp</h3><button class="nav-i" data-go="help" aria-current="${v.type === 'help'}"><svg><use href="#i-help"/></svg>Hướng dẫn</button>`;
}
function go(target) {
  if (target === 'addbranch') {
    S.content.branches.push({ name: 'Chi nhánh mới', dist: '', addr: '', phone: '', map: '', color: '#5E412D', tagline: '', desc: '', soon: true, cover: { src: '', x: 50, y: 50, z: 1 }, rows: [['Deluxe', [0, 0, 0, 0, 0]]], notes: [], feat: [], rooms: [] });
    markDirty(); target = 'branch:' + (S.content.branches.length - 1);
  }
  const [type, key] = target.split(':');
  S.view = type === 'page' ? { type, key } : type === 'branch' ? { type, index: +key } : { type: 'help' };
  try { localStorage.setItem('qh-admin-view', target); } catch (e) {}
  renderSide();
  if (type === 'page') renderPage(key); else if (type === 'branch') renderBranch(+key); else renderHelp();
}

/* ---------------- sửa trang ---------------- */
let frame = null, frameReady = false;
const EMPTY = { img: {}, txt: {} };
const pageData = (key, create) => { let p = S.content.pages[key]; if (!p) { if (!create) return EMPTY; p = S.content.pages[key] = { img: {}, txt: {} }; } p.img = p.img || {}; p.txt = p.txt || {}; return p; };
function tidyPage(key) { const p = S.content.pages[key]; if (p && !Object.keys(p.img || {}).length && !Object.keys(p.txt || {}).length) delete S.content.pages[key]; }
function post(msg) { if (frame && frame.contentWindow) frame.contentWindow.postMessage(Object.assign({ qh: 1 }, msg), location.origin); }
function renderPage(key) {
  const p = S.pages.find(x => x.key === key); if (!p) return go('help');
  const isBranch = p.branch != null;
  $('#view').innerHTML = `
  <div class="pe" id="pe">
    <div class="pe-list">
      <div class="pe-head">
        <p class="eyebrow">Ảnh &amp; chữ trên trang</p>
        <h1>${esc(p.name)}</h1>
        <div class="pe-tools">
          <div class="seg" role="group" aria-label="Lọc"><button data-f="all" aria-pressed="${S.filter === 'all'}">Tất cả</button><button data-f="img" aria-pressed="${S.filter === 'img'}">Ảnh</button><button data-f="txt" aria-pressed="${S.filter === 'txt'}">Chữ</button></div>
          <input class="pe-search" type="search" placeholder="Tìm chữ…" value="${esc(S.q)}" id="peQ">
          <button class="btn ghost sm mobile-only" id="showPrev" type="button"><svg><use href="#i-phone"/></svg>Xem trang</button>
        </div>
      </div>
      ${S.draftRestored ? `<div class="banner">Đã mở lại bản nháp chưa xuất bản từ ${new Date(S.draftRestored).toLocaleString('vi-VN')}.<button class="link" id="dropDraft">Bỏ bản nháp</button></div>` : ''}
      <div class="pe-scroll" id="peList"><p class="muted" style="padding:20px 6px">Đang đọc nội dung trang…</p></div>
    </div>
    <div class="pe-prev">
      <div class="prev-bar"><div class="seg" role="group" aria-label="Thiết bị"><button data-dev="desktop" aria-pressed="${S.dev === 'desktop'}"><svg><use href="#i-desk"/></svg></button><button data-dev="phone" aria-pressed="${S.dev === 'phone'}"><svg><use href="#i-phone"/></svg></button></div><span class="muted">Bấm vào ảnh hoặc chữ trên trang để sửa</span><span class="sp"></span><button class="btn ghost sm mobile-only" id="backList" type="button">Danh sách</button></div>
      <div class="prev-stage" id="prevStage"><div class="prev-load" id="prevLoad">Đang mở trang…</div><iframe class="prev-frame" id="prevFrame" title="Xem trước ${esc(p.name)}"></iframe></div>
    </div>
  </div>`;
  if (isBranch) $('#peList').insertAdjacentHTML('beforebegin', `<div class="pe-note" style="margin:12px 14px 0">Ảnh đại diện, bảng giá, danh sách phòng và thông tin liên hệ của chi nhánh sửa ở mục <button class="link" data-go="branch:${p.branch}">Chi nhánh ${esc(p.name)}</button>.</div>`);
  frame = $('#prevFrame'); frameReady = false;
  sizeFrame();
  frame.src = SITE + p.file + '?admin=1';
  $$('[data-f]').forEach(b => b.addEventListener('click', () => { S.filter = b.dataset.f; $$('[data-f]').forEach(x => x.setAttribute('aria-pressed', x === b)); renderSlots(key); }));
  $('#peQ').addEventListener('input', e => { S.q = e.target.value; renderSlots(key); });
  $$('[data-dev]').forEach(b => b.addEventListener('click', () => { S.dev = b.dataset.dev; $$('[data-dev]').forEach(x => x.setAttribute('aria-pressed', x === b)); sizeFrame(); }));
  const dd = $('#dropDraft'); if (dd) dd.addEventListener('click', () => { S.content = JSON.parse(S.published); S.draftRestored = null; markDirty(); go('page:' + key); });
  $('#backList').addEventListener('click', () => $('#pe').classList.remove('show-prev'));
  $('#showPrev').addEventListener('click', () => { $('#pe').classList.add('show-prev'); requestAnimationFrame(sizeFrame); });
}
function sizeFrame() {
  if (!frame) return; const st = $('#prevStage'); const W = S.dev === 'phone' ? 390 : 1366;
  const scale = Math.min(1, (st.clientWidth - 24) / W); const H = st.clientHeight / scale;
  frame.style.width = W + 'px'; frame.style.height = H + 'px'; frame.style.transform = `translateX(-50%) scale(${scale})`;
}
addEventListener('resize', sizeFrame);
addEventListener('message', ev => {
  const d = ev.data; if (ev.origin !== location.origin || !d || !d.qh || !S.view || S.view.type !== 'page') return;
  if (d.type === 'slots') {
    const key = S.view.key; S.slots[key] = d.slots; frameReady = true; $('#prevLoad') && $('#prevLoad').remove();
    const pd = pageData(key);
    Object.keys(pd.img).forEach(k => post({ type: 'apply', kind: 'img', key: k, entry: pd.img[k] }));
    Object.keys(pd.txt).forEach(k => post({ type: 'apply', kind: 'txt', key: k, entry: pd.txt[k] }));
    renderSlots(key);
  }
  if (d.type === 'select') {
    const el = $(`.slot[data-k="${d.kind}:${d.key}"]`);
    if (S.filter !== 'all' && S.filter !== d.kind) { S.filter = 'all'; renderSlots(S.view.key); }
    const el2 = $(`.slot[data-k="${d.kind}:${d.key}"]`) || el; if (!el2) return;
    $$('.slot.hl').forEach(x => x.classList.remove('hl')); el2.classList.add('hl'); el2.scrollIntoView({ block: 'center', behavior: 'smooth' });
    if (d.kind === 'img') el2.querySelector('[data-act="crop"]').click(); else { const ta = el2.querySelector('textarea'); ta && ta.focus(); }
  }
});
function renderSlots(key) {
  const slots = S.slots[key]; if (!slots) return;
  const pd = pageData(key); const q = S.q.trim().toLowerCase();
  const match = s => !q || (s.label || '').toLowerCase().includes(q) || (s.kind === 'txt' && toPlain((pd.txt[s.key] && pd.txt[s.key].v) || s.def).toLowerCase().includes(q));
  const list = slots.filter(s => (S.filter === 'all' || s.kind === S.filter) && match(s));
  const groups = []; list.forEach(s => { let g = groups.find(x => x.name === s.section); if (!g) groups.push(g = { name: s.section, items: [] }); g.items.push(s); });
  $('#peList').innerHTML = groups.length ? groups.map(g => `<div class="sec"><p class="sec-t">${esc(g.name)}</p>${g.items.map(s => slotHtml(s, pd)).join('')}</div>`).join('') : '<p class="muted" style="padding:20px 6px">Không có mục nào khớp.</p>';
  $$('#peList .slot').forEach(el => wireSlot(el, key));
  $$('#peList .thumb .pv-img').forEach(el => { const s = slots.find(x => 'img:' + x.key === el.closest('.slot').dataset.k); imgBox(el, pd.img[s.key], s.src); });
}
function slotHtml(s, pd) {
  if (s.kind === 'img') {
    const ch = !!pd.img[s.key];
    return `<div class="slot slot-img${ch ? ' changed' : ''}" data-k="img:${s.key}"><div class="thumb" style="aspect-ratio:${s.ar}" data-act="crop" title="Căn khung"><div class="pv-img"></div></div><div class="slot-meta"><b>${esc(s.label)}</b><div class="slot-acts"><button class="btn ghost sm" data-act="replace" type="button">Đổi ảnh</button><button class="btn ghost sm" data-act="crop" type="button">Căn khung</button>${ch ? '<button class="revert" data-act="revert" type="button"><svg><use href="#i-undo"/></svg>Ảnh gốc</button>' : ''}</div></div></div>`;
  }
  const cur = pd.txt[s.key] ? pd.txt[s.key].v : s.def; const ch = !!pd.txt[s.key];
  const plain = toPlain(cur); const rows = Math.min(8, Math.max(1, Math.ceil(plain.length / 46) + (plain.match(/\n/g) || []).length));
  return `<div class="slot slot-txt${ch ? ' changed' : ''}" data-k="txt:${s.key}"><label><span>${esc(s.label)}</span>${ch ? '<button class="revert" data-act="revert" type="button"><svg><use href="#i-undo"/></svg>Chữ gốc</button>' : ''}</label><textarea rows="${rows}">${esc(plain)}</textarea></div>`;
}
function wireSlot(el, key) {
  const [kind, k] = el.dataset.k.split(':'); const s = S.slots[key].find(x => x.kind === kind && x.key === k);
  el.addEventListener('click', ev => { if (!ev.target.closest('button, textarea')) frameReady && post({ type: 'focus', kind, key: k }); });
  el.addEventListener('focusin', () => frameReady && post({ type: 'focus', kind, key: k }));
  if (kind === 'txt') {
    const ta = el.querySelector('textarea');
    ta.addEventListener('input', () => {
      const pd = pageData(key, true); const html = fromPlain(ta.value, s.def);
      if (toPlain(html) === toPlain(s.def)) delete pd.txt[k]; else pd.txt[k] = { h: s.h, v: html };
      const e = pd.txt[k] || null; tidyPage(key);
      post({ type: 'apply', kind, key: k, entry: e }); el.classList.toggle('changed', !!e); markDirty();
    });
  }
  el.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', ev => {
    ev.stopPropagation();
    const act = b.dataset.act; const pd = pageData(key);
    const apply = (e) => { const pd = pageData(key, true); e = Object.assign({}, e); if (!e.src || absUrl(e.src) === s.src) delete e.src; else e.src = relSrc(e.src); pd.img[k] = Object.assign({ h: s.h }, e); post({ type: 'apply', kind: 'img', key: k, entry: pd.img[k] }); markDirty(); renderSlots(key); };
    if (act === 'crop') openCrop({ title: s.label, entry: pd.img[k], fallback: s.src, ar: s.ar, onApply: apply });
    if (act === 'replace') pickAndCrop({ title: s.label, ar: s.ar, onApply: apply });
    if (act === 'revert') {
      if (kind === 'img') delete pd.img[k]; else delete pd.txt[k];
      tidyPage(key); post({ type: 'apply', kind, key: k, entry: null }); markDirty(); renderSlots(key);
    }
  }));
}

/* ---------------- sửa chi nhánh ---------------- */
function renderBranch(i) {
  const b = S.content.branches[i]; if (!b) return go('help');
  b.rows = b.rows || []; b.notes = b.notes || []; b.feat = b.feat || []; b.rooms = b.rooms || []; b.cover = b.cover || {};
  const tiers = [...new Set([...b.rows.map(r => r[0]).filter(Boolean), ...TIERS])];
  $('#view').innerHTML = `
  <div class="be"><div class="be-in">
    <div class="be-head"><span class="sw" style="--d:${esc(b.color)}"></span><div><p class="eyebrow">Chi nhánh ${String(i + 1).padStart(2, '0')}</p><h1>${esc(b.name)}</h1></div></div>
    <div class="pe-note">Thay đổi ở đây hiện lên web sau khi bấm <b>Xuất bản</b> (khoảng 1–2 phút).</div>

    <section class="card"><h2>Thông tin</h2><p class="muted">Hiển thị ở menu, thẻ chi nhánh, trang chi nhánh và nút gọi/nhắn tin.</p>
      <div class="grid2">
        <label class="f">Tên chi nhánh<input type="text" data-b="name" value="${esc(b.name)}"></label>
        <label class="f">Quận / khu vực<input type="text" data-b="dist" value="${esc(b.dist)}"></label>
        <label class="f full">Địa chỉ<input type="text" data-b="addr" value="${esc(b.addr)}"></label>
        <label class="f">Hotline<input type="tel" data-b="phone" value="${esc(b.phone)}" placeholder="0797 000 000"></label>
        <label class="f">Link Google Maps<input type="url" data-b="map" value="${esc(b.map)}" placeholder="https://maps.app.goo.gl/…"></label>
        <label class="f">Câu giới thiệu ngắn<input type="text" data-b="tagline" value="${esc(b.tagline)}"></label>
        <label class="f">Màu chi nhánh<input type="color" data-b="color" value="${esc(b.color || '#5E412D')}" style="height:40px;padding:4px"></label>
        <label class="f full">Mô tả<textarea data-b="desc" rows="3">${esc(b.desc)}</textarea></label>
        <label class="toggle full"><input type="checkbox" data-b="soon" ${b.soon ? 'checked' : ''}> Trang chi nhánh hiển thị "Coming soon"</label>
      </div>
    </section>

    <section class="card"><h2>Ảnh đại diện</h2><p class="muted">Dùng ở trang chi nhánh, menu Chi nhánh, thẻ chi nhánh trên trang chủ và trang Câu chuyện.</p>
      <div class="cover-row"><div class="pv" style="aspect-ratio:.75"><div class="pv-img" id="coverPv"></div></div>
      <div class="slot-acts"><button class="btn ghost" type="button" id="coverReplace">Đổi ảnh</button><button class="btn ghost" type="button" id="coverCrop">Căn khung</button></div></div>
    </section>

    <section class="card"><h2>Tiện ích</h2><p class="muted">Gõ rồi nhấn Enter để thêm.</p>
      <div class="chips" id="featChips">${b.feat.map((f, k) => `<span class="chip">${esc(f)}<button type="button" data-rmfeat="${k}" aria-label="Xoá ${esc(f)}"><svg><use href="#i-x"/></svg></button></span>`).join('')}<input type="text" id="featIn" placeholder="Thêm tiện ích…"></div>
    </section>

    <section class="card"><h2>Bảng giá</h2><p class="muted">Đơn vị: nghìn đồng (ví dụ 290 = 290.000đ).</p>
      <div class="tbl-wrap"><table class="ed"><thead><tr><th>Hạng phòng</th>${PRICE_COLS.map(c => `<th>${c}</th>`).join('')}<th></th></tr></thead>
      <tbody>${b.rows.map((r, k) => `<tr><td><input type="text" data-row="${k}" data-c="t" value="${esc(r[0])}" list="tierList"></td>${[0, 1, 2, 3, 4].map(c => `<td class="num"><input type="number" min="0" step="10" data-row="${k}" data-c="${c}" value="${esc((r[1] || [])[c] ?? 0)}"></td>`).join('')}<td><div class="row-acts"><button class="icon" type="button" data-rmrow="${k}" aria-label="Xoá hạng"><svg><use href="#i-x"/></svg></button></div></td></tr>`).join('')}</tbody></table></div>
      <datalist id="tierList">${TIERS.map(t => `<option value="${t}">`).join('')}</datalist>
      <button class="btn ghost sm add-row" type="button" id="addRow"><svg><use href="#i-plus"/></svg>Thêm hạng phòng</button>
      <p class="label" style="margin-top:16px">Ghi chú ưu đãi</p>
      <div class="list-ed">${b.notes.map((n, k) => `<div class="li"><input type="text" data-note="${k}" value="${esc(n)}"><button class="icon" type="button" data-rmnote="${k}" aria-label="Xoá ghi chú"><svg><use href="#i-x"/></svg></button></div>`).join('')}</div>
      <button class="btn ghost sm add-row" type="button" id="addNote"><svg><use href="#i-plus"/></svg>Thêm ghi chú</button>
    </section>

    <section class="card"><h2>Danh sách phòng</h2><p class="muted">Mỗi phòng có ảnh nhỏ (hiện trong lưới) và ảnh chi tiết (mở khi khách bấm vào phòng).</p>
      <div class="tbl-wrap"><table class="ed"><thead><tr><th>Ảnh nhỏ</th><th>Số phòng</th><th>Hạng</th><th>m²</th><th>Ảnh chi tiết</th><th></th></tr></thead>
      <tbody>${b.rooms.map((r, k) => `<tr>
        <td><button class="rthumb${(r.thumb && r.thumb.src) || (r.poster && r.poster.src) ? '' : ' empty'}" type="button" data-rthumb="${k}" title="Căn khung ảnh nhỏ"><span class="pv-img"></span>${(r.thumb && r.thumb.src) || (r.poster && r.poster.src) ? '' : 'Chưa có ảnh'}</button></td>
        <td><input type="text" data-room="${k}" data-c="no" value="${esc(r.no)}" style="width:90px"></td>
        <td><select data-room="${k}" data-c="tier">${tiers.map(t => `<option ${t === r.tier ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select></td>
        <td class="num"><input type="number" min="0" data-room="${k}" data-c="m2" value="${esc(r.m2 ?? '')}" style="width:76px"></td>
        <td><div class="poster-btn"><span class="mini" style="background-image:url('${esc(absUrl(r.poster && r.poster.src))}')"></span><button class="btn ghost sm" type="button" data-rposter="${k}">${r.poster && r.poster.src ? 'Đổi' : 'Tải lên'}</button></div></td>
        <td><div class="row-acts"><button class="icon" type="button" data-rup="${k}" aria-label="Lên"><svg><use href="#i-up"/></svg></button><button class="icon" type="button" data-rdown="${k}" aria-label="Xuống"><svg><use href="#i-down"/></svg></button><button class="icon" type="button" data-rrm="${k}" aria-label="Xoá phòng"><svg><use href="#i-x"/></svg></button></div></td></tr>`).join('')}</tbody></table></div>
      <button class="btn ghost sm add-row" type="button" id="addRoom"><svg><use href="#i-plus"/></svg>Thêm phòng</button>
    </section>

    <section class="card danger-zone"><div><h2 style="font-family:var(--display);font-weight:500;font-size:19px;margin:0">Xoá chi nhánh</h2><p class="muted" style="margin:4px 0 0;font-size:13px">Xoá khỏi menu, trang chủ và trang riêng sau khi xuất bản.</p></div><div id="delZone"><button class="btn danger" type="button" id="delBranch">Xoá chi nhánh này</button></div></section>
  </div></div>`;
  const rer = () => { markDirty(); renderSide(); renderBranch(i); };
  imgBox($('#coverPv'), b.cover);
  $$('.rthumb').forEach(el => { const r = b.rooms[+el.dataset.rthumb]; const t = (r.thumb && r.thumb.src) ? r.thumb : (r.poster && r.poster.src ? { src: r.poster.src, x: 50, y: 12, z: 1 } : null); if (t) imgBox(el.querySelector('.pv-img'), t); });
  $$('[data-b]').forEach(inp => inp.addEventListener(inp.type === 'checkbox' || inp.type === 'color' ? 'change' : 'input', () => {
    const k = inp.dataset.b; b[k] = inp.type === 'checkbox' ? inp.checked : inp.value; markDirty();
    if (k === 'name' || k === 'color' || k === 'soon') { renderSide(); $('.be-head h1').textContent = b.name; $('.be-head .sw').style.setProperty('--d', b.color); }
  }));
  $('#coverCrop').addEventListener('click', () => openCrop({ title: 'Ảnh đại diện ' + b.name, entry: b.cover, ar: .75, arM: 1.35, onApply: e => { b.cover = e; imgBox($('#coverPv'), e); markDirty(); } }));
  $('#coverReplace').addEventListener('click', () => pickAndCrop({ title: 'Ảnh đại diện ' + b.name, ar: .75, arM: 1.35, onApply: e => { b.cover = e; imgBox($('#coverPv'), e); markDirty(); } }));
  $('#featIn').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.value.trim()) { e.preventDefault(); b.feat.push(e.target.value.trim()); rer(); setTimeout(() => $('#featIn').focus(), 0); } });
  $$('[data-rmfeat]').forEach(x => x.addEventListener('click', () => { b.feat.splice(+x.dataset.rmfeat, 1); rer(); }));
  $$('[data-row]').forEach(inp => inp.addEventListener('input', () => { const r = b.rows[+inp.dataset.row]; if (inp.dataset.c === 't') r[0] = inp.value; else { r[1] = r[1] || [0, 0, 0, 0, 0]; r[1][+inp.dataset.c] = +inp.value || 0; } markDirty(); }));
  $$('[data-rmrow]').forEach(x => x.addEventListener('click', () => { b.rows.splice(+x.dataset.rmrow, 1); rer(); }));
  $('#addRow').addEventListener('click', () => { b.rows.push(['', [0, 0, 0, 0, 0]]); rer(); });
  $$('[data-note]').forEach(inp => inp.addEventListener('input', () => { b.notes[+inp.dataset.note] = inp.value; markDirty(); }));
  $$('[data-rmnote]').forEach(x => x.addEventListener('click', () => { b.notes.splice(+x.dataset.rmnote, 1); rer(); }));
  $('#addNote').addEventListener('click', () => { b.notes.push(''); rer(); });
  $$('[data-room]').forEach(inp => inp.addEventListener(inp.tagName === 'SELECT' ? 'change' : 'input', () => { const r = b.rooms[+inp.dataset.room]; const c = inp.dataset.c; r[c] = c === 'm2' ? (inp.value ? +inp.value : null) : inp.value; markDirty(); renderSide(); }));
  $$('[data-rthumb]').forEach(x => x.addEventListener('click', () => {
    const r = b.rooms[+x.dataset.rthumb];
    const base = (r.thumb && r.thumb.src) ? r.thumb : (r.poster && r.poster.src ? { src: r.poster.src, x: 50, y: 12, z: 1 } : null);
    const opts = { title: 'Ảnh nhỏ phòng ' + (r.no || ''), ar: 4 / 3, onApply: e => { r.thumb = e; rer(); } };
    if (base) openCrop(Object.assign(opts, { entry: base })); else pickAndCrop(opts);
  }));
  $$('[data-rposter]').forEach(x => x.addEventListener('click', () => {
    const r = b.rooms[+x.dataset.rposter];
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; try { const up = await uploadImage(f); r.poster = { src: up.src }; r.ar = +up.ar.toFixed(3); if (!r.thumb || !r.thumb.src || r.thumb.auto) r.thumb = { src: up.src, x: 50, y: 12, z: 1, auto: true }; rer(); toast('Đã tải ảnh chi tiết. Bấm vào ảnh nhỏ để căn khung nếu cần.'); } catch (e) { toast(e.message, true); } };
    inp.click();
  }));
  const move = (k, d) => { const j = k + d; if (j < 0 || j >= b.rooms.length) return; [b.rooms[k], b.rooms[j]] = [b.rooms[j], b.rooms[k]]; rer(); };
  $$('[data-rup]').forEach(x => x.addEventListener('click', () => move(+x.dataset.rup, -1)));
  $$('[data-rdown]').forEach(x => x.addEventListener('click', () => move(+x.dataset.rdown, 1)));
  $$('[data-rrm]').forEach(x => x.addEventListener('click', () => { b.rooms.splice(+x.dataset.rrm, 1); rer(); }));
  $('#addRoom').addEventListener('click', () => { b.rooms.push({ no: '', tier: b.rows[0] ? b.rows[0][0] : 'Deluxe', m2: null, ar: .75, poster: {}, thumb: {} }); rer(); });
  $('#delBranch').addEventListener('click', () => {
    $('#delZone').innerHTML = `<div class="confirm">Chắc chắn xoá ${esc(b.name)}?<button class="btn danger sm" id="delYes" type="button">Xoá</button><button class="btn ghost sm" id="delNo" type="button">Không</button></div>`;
    $('#delYes').addEventListener('click', () => { S.content.branches.splice(i, 1); markDirty(); toast('Đã xoá chi nhánh. Bấm Xuất bản để áp dụng.'); go(S.content.branches.length ? 'branch:0' : 'help'); });
    $('#delNo').addEventListener('click', () => renderBranch(i));
  });
}

/* ---------------- hướng dẫn ---------------- */
function renderHelp() {
  $('#view').innerHTML = `<div class="help"><div class="help-in">
    <h1>Hướng dẫn nhanh</h1><p class="muted">Mọi thay đổi chỉ lên web sau khi bấm <b>Xuất bản</b>. Trước đó bạn có thể sửa thoải mái, bản nháp tự lưu trong trình duyệt.</p>
    <h2>Sửa ảnh và chữ trên một trang</h2>
    <ol><li>Chọn trang ở menu trái, mục <b>Ảnh &amp; chữ trên trang</b>.</li>
    <li>Bấm thẳng vào ảnh hoặc chữ trên bản xem trước, hoặc tìm trong danh sách bên trái.</li>
    <li>Ảnh: <b>Đổi ảnh</b> để tải ảnh mới, <b>Căn khung</b> để kéo chọn phần ảnh hiển thị và phóng to. Khung xem trước cho thấy ảnh trên máy tính và điện thoại.</li>
    <li>Chữ: gõ trực tiếp. Bọc chữ trong dấu sao để in nghiêng, ví dụ <code>Năm ngôi nhà, *năm sắc màu.*</code> Xuống dòng để tách dòng tiêu đề.</li>
    <li>Bấm <b>Ảnh gốc</b> hoặc <b>Chữ gốc</b> để quay về nội dung ban đầu.</li></ol>
    <h2>Sửa chi nhánh, giá và phòng</h2>
    <ol><li>Chọn chi nhánh ở mục <b>Chi nhánh, giá &amp; phòng</b>.</li>
    <li>Sửa thông tin, ảnh đại diện, tiện ích, bảng giá (đơn vị nghìn đồng) và danh sách phòng.</li>
    <li>Thêm phòng: bấm <b>Thêm phòng</b>, điền số phòng, hạng, m², tải <b>Ảnh chi tiết</b>. Ảnh nhỏ tự lấy từ ảnh chi tiết, bấm vào để căn khung.</li>
    <li>Bật <b>Coming soon</b> khi chi nhánh chưa có ảnh phòng.</li></ol>
    <h2>Xuất bản</h2>
    <p>Bấm <b>Xuất bản</b> ở góc trên. Web tự dựng lại và cập nhật sau khoảng 1–2 phút. Hệ thống giữ 20 bản lưu gần nhất để khôi phục khi cần.</p>
    <h2>Thêm người quản trị</h2>
    <p>Trong Netlify: <b>Project configuration → Identity → Invite users</b>, nhập email. Người được mời nhận email, bấm đường dẫn, đặt mật khẩu là vào được trang này.</p>
    ${DEMO ? '<p class="pe-note">Bạn đang ở <b>chế độ thử</b>: không cần đăng nhập, thay đổi chỉ lưu trong trình duyệt này và không lên web.</p>' : ''}
  </div></div>`;
}

/* ---------------- đăng nhập ---------------- */
function showAuth(form, msg, ok) {
  $('#app').hidden = true; $('#auth').hidden = false;
  ['fLogin', 'fForgot', 'fSetPass'].forEach(id => { $('#' + id).hidden = id !== form; });
  const m = $('#authMsg'); m.textContent = msg || ''; m.classList.toggle('ok', !!ok);
}
async function startApp() {
  $('#auth').hidden = true; $('#app').hidden = false;
  $('#who').textContent = DEMO ? 'Chế độ thử' : (S.user && S.user.email) || '';
  $('#logout').textContent = DEMO ? 'Thoát chế độ thử' : 'Đăng xuất';
  try { await loadContent(); } catch (e) { toast('Không tải được nội dung: ' + e.message, true); return; }
  markDirty();
  let last = null; try { last = localStorage.getItem('qh-admin-view'); } catch (e) {}
  const okLast = last && ((last.startsWith('page:') && S.pages.some(p => 'page:' + p.key === last)) || (last.startsWith('branch:') && S.content.branches[+last.split(':')[1]]) || last === 'help');
  go(okLast ? last : 'page:home');
}
function wireAuth() {
  $('#toForgot').addEventListener('click', () => showAuth('fForgot'));
  $('#toLogin').addEventListener('click', () => showAuth('fLogin'));
  $('#fLogin').addEventListener('submit', async e => {
    e.preventDefault(); $('#authMsg').textContent = 'Đang đăng nhập…'; $('#authMsg').classList.add('ok');
    try { S.user = await ID.login($('#lEmail').value.trim(), $('#lPass').value); startApp(); }
    catch (err) { showAuth('fLogin', 'Email hoặc mật khẩu chưa đúng.'); }
  });
  $('#fForgot').addEventListener('submit', async e => {
    e.preventDefault();
    try { await ID.requestPasswordRecovery($('#fEmail').value.trim()); showAuth('fLogin', 'Đã gửi email. Mở email và bấm đường dẫn để đặt mật khẩu mới.', true); }
    catch (err) { showAuth('fForgot', 'Không gửi được email. Kiểm tra lại địa chỉ.'); }
  });
}
async function boot() {
  initCrop();
  document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); go(g.dataset.go); } });
  $('#publish').addEventListener('click', publish);
  $('#logout').addEventListener('click', async () => { if (DEMO) { location.href = location.pathname; return; } try { await ID.logout(); } catch (e) {} location.reload(); });
  addEventListener('beforeunload', e => { if (S.content && JSON.stringify(S.content) !== S.published) { e.preventDefault(); e.returnValue = ''; } });
  if (DEMO) { startApp(); return; }
  try { ID = await import('https://cdn.jsdelivr.net/npm/@netlify/identity@2.0.0/+esm'); }
  catch (e) { showAuth('fLogin', 'Không tải được công cụ đăng nhập. Kiểm tra kết nối mạng rồi tải lại trang.'); return; }
  wireAuth();
  const h = new URLSearchParams(location.hash.slice(1));
  const inv = h.get('invite_token'), rec = h.get('recovery_token');
  if (inv || rec) {
    $('#spTitle').textContent = inv ? 'Chào mừng đến trang quản trị' : 'Đặt mật khẩu mới';
    $('#spNote').textContent = inv ? 'Chọn mật khẩu cho tài khoản của bạn (ít nhất 8 ký tự).' : 'Nhập mật khẩu mới cho tài khoản.';
    showAuth('fSetPass');
    $('#fSetPass').addEventListener('submit', async e => {
      e.preventDefault();
      try { S.user = inv ? await ID.acceptInvite(inv, $('#spPass').value) : await ID.recoverPassword(rec, $('#spPass').value); history.replaceState(null, '', location.pathname); startApp(); }
      catch (err) { showAuth('fSetPass', 'Đường dẫn đã hết hạn hoặc không hợp lệ. Nhờ người quản lý gửi lại lời mời.'); }
    });
    return;
  }
  try { await ID.handleAuthCallback(); } catch (e) {}
  try { S.user = await ID.getUser(); } catch (e) { S.user = null; }
  if (S.user) startApp(); else showAuth('fLogin');
}
boot();
