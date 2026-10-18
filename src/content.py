"""Lớp nội dung Qhome: đọc content.json (do trang quản trị lưu), chuẩn hoá dữ liệu chi nhánh,
sinh CSS ảnh động và các khối HTML phụ thuộc dữ liệu chi nhánh."""
import json, os, re, html as _html

ROOT = os.environ.get('QH_ROOT', os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ARROW = '<svg><use href="#arrow"/></svg>'

DEFAULT_COVER = {'p-bc3': 'bc3', 'p-svh': 'svh', 'p-32': '32', 'p-ldh': 'ldh', 'p-tqd': 'tqd'}
DEFAULT_TEXT = {
    'Bàu Cát': ('Sáng, sạch và đầy màu', 'Phòng trắng sáng, đầu giường nhung và gạch ốp mỗi phòng một màu: đỏ, hồng, xanh rêu, xanh navy. 10 phòng Deluxe và Premium.'),
    'Sư Vạn Hạnh': ('Rộng rãi, tối giản, có bồn tắm', 'Phòng rộng 20–32m², tường trắng, sàn gỗ và tranh nghệ thuật. Ba phòng Suite có bồn tắm nằm và ban công.'),
    'Ba Tháng Hai': ('Một khu vườn trong phòng', 'Gương lượn sóng, tường sọc và ban công ở hầu hết các phòng. Suite 401 có bồn tắm đá giữa vườn cây. Chi nhánh duy nhất có đủ bốn hạng phòng.'),
    'Lê Đại Hành': ('Ấm như phòng khách nhà mình', 'Sofa xanh rêu, rèm vải mỏng và đèn ngủ vàng. Gần gũi, giản dị, ngay giữa Quận 11.'),
    'Thích Quảng Đức': ('Mỗi phòng một sắc màu', 'Tường hồng, cam, xanh rêu và máy chiếu 100 inch. Có bếp chung, bãi đậu xe hơi và khu vườn có ghế ngồi, trong hẻm yên tĩnh ở Phú Nhuận.'),
}
TIERS = ['Standard', 'Deluxe', 'Premium', 'Suite']


def esc(s):
    return _html.escape(str(s if s is not None else ''), quote=True)


def phone_txt(p):
    d = re.sub(r'\D', '', p or '')
    return f'{d[:4]} {d[4:7]} {d[7:]}' if len(d) == 10 else (p or '')


def slugify(s):
    import unicodedata
    s = unicodedata.normalize('NFD', s.replace('đ', 'd').replace('Đ', 'D'))
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-') or 'chi-nhanh'


def _lum(hexc):
    h = hexc.lstrip('#')
    if len(h) == 3: h = ''.join(c * 2 for c in h)
    r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    f = lambda c: c / 12.92 if c <= .03928 else ((c + .055) / 1.055) ** 2.4
    return .2126 * f(r) + .7152 * f(g) + .0722 * f(b)


def _darken(hexc, k=.7):
    h = hexc.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return '#%02X%02X%02X' % (int(r * k), int(g * k), int(b * k))


def default_branches():
    raw = json.load(open(f'{ROOT}/src/branches.json', encoding='utf-8'))
    out = []
    for b in raw:
        tag, desc = DEFAULT_TEXT.get(b['name'], ('', ''))
        cover = DEFAULT_COVER.get(b['v'])
        out.append({
            'name': b['name'], 'dist': b['dist'], 'addr': b['addr'], 'phone': b['phone'], 'map': b['map'],
            'color': b['c'], 'tagline': tag, 'desc': desc, 'soon': not b['rooms'],
            'cover': {'src': f'assets/img/{cover}.webp' if cover else '', 'x': 50, 'y': 50, 'z': 1},
            'rows': b['rows'], 'notes': b['notes'], 'feat': b['feat'],
            'rooms': [{'no': r['no'], 'tier': r['tier'], 'm2': r['m2'], 'ar': r['ar'],
                       'poster': {'src': f'assets/img/rooms/r{r["v"][2:]}.webp'},
                       'thumb': {'src': f'assets/img/thumbs/t{r["v"][2:]}.webp', 'x': 50, 'y': 50, 'z': 1}} for r in b['rooms']],
        })
    return out


# thứ tự chi nhánh mặc định; khi người quản trị tự sắp xếp trong /admin thì giữ theo /admin (branchOrder = "manual")
BRANCH_ORDER = ['Lê Đại Hành', 'Sư Vạn Hạnh', 'Thích Quảng Đức', 'Ba Tháng Hai', 'Bàu Cát']
def apply_order(branches, flag):
    if flag == 'manual': return branches
    rank = lambda b: BRANCH_ORDER.index(b.get('name')) if b.get('name') in BRANCH_ORDER else len(BRANCH_ORDER)
    return sorted(branches, key=rank)


def load_content():
    """content.json do build plugin kéo về từ Netlify Blobs (nếu có)."""
    p = f'{ROOT}/src/content.json'
    data = {}
    if os.path.exists(p):
        try: data = json.load(open(p, encoding='utf-8'))
        except Exception as e: print('content.json lỗi, dùng mặc định:', e)
    flag = data.get('branchOrder')
    branches = apply_order(data.get('branches') or default_branches(), flag)
    pages = data.get('pages') or {}
    return {'version': 1, 'branches': branches, 'pages': pages, 'updated': data.get('updated'), 'branchOrder': flag if flag == 'manual' else 'v1'}


def normalize(branches):
    """Biến dữ liệu chi nhánh (dạng admin) thành dạng dùng khi dựng trang."""
    B = []
    used = set()
    for i, s in enumerate(branches):
        c = s.get('color') or '#5E412D'
        light = _lum(c) > .35
        slug = slugify(s.get('name') or f'chi-nhanh-{i+1}')
        while slug in used: slug += '-2'
        used.add(slug)
        rows = [[r[0], [int(x or 0) for x in (list(r[1]) + [0] * 5)[:5]]] for r in (s.get('rows') or []) if r and r[0]]
        rooms = []
        for ri, r in enumerate(s.get('rooms') or []):
            rooms.append({'no': str(r.get('no') or ''), 'tier': r.get('tier') or 'Deluxe', 'm2': r.get('m2') or None,
                          'ar': float(r.get('ar') or .75), 'pv': f'rp-{i}-{ri}', 'tv': f'rt-{i}-{ri}',
                          'poster': r.get('poster') or {}, 'thumb': r.get('thumb') or {}})
        B.append({
            'n': f'{i+1:02d}', 'name': s.get('name') or f'Chi nhánh {i+1}', 'dist': s.get('dist') or '', 'addr': s.get('addr') or '',
            'phone': re.sub(r'\D', '', s.get('phone') or ''), 'phoneTxt': phone_txt(s.get('phone')), 'map': s.get('map') or '#',
            'c': c, 'ink': '#2A1E16' if light else '#FFFFFF', 't': _darken(c, .7) if light else c,
            'tagline': s.get('tagline') or '', 'desc': s.get('desc') or '', 'soon': bool(s.get('soon')) or not rooms,
            'cover': s.get('cover') or {}, 'v': f'cv-{i}', 'slug': slug,
            'rows': rows or [['Deluxe', [0, 0, 0, 0, 0]]], 'notes': s.get('notes') or [], 'feat': s.get('feat') or [], 'rooms': rooms,
        })
    return B


def img_rule(sel, e, extra=''):
    e = e or {}
    if not e.get('src'): return ''
    x, y, z = e.get('x', 50), e.get('y', 50), float(e.get('z') or 1)
    if e.get('fit') == 'full':
        return f'.ph{sel}{{background-image:url("{e["src"]}");background-position:center;background-size:contain;background-repeat:no-repeat;background-color:#EDE3D4;{extra}}}\n'
    # đặt thẳng background-image trong <style> của trang để đường dẫn ảnh tính theo trang, không theo style.css
    css = f'background-image:url("{e["src"]}");background-position:{x}% {y}%;'
    if abs(z - 1) > .001: css += f'scale:{z};transform-origin:{x}% {y}%;'
    return f'.ph{sel}{{{css}{extra}}}\n'


def image_css(B, rooms_for=None):
    """CSS ảnh động: ảnh đại diện mọi chi nhánh + ảnh phòng (của tất cả hoặc một chi nhánh)."""
    out = ''.join(img_rule(f'.ph[data-v="{b["v"]}"]', b['cover']) for b in B)
    for bi, b in enumerate(B):
        if rooms_for is not None and bi != rooms_for: continue
        for r in b['rooms']:
            p = r['poster'] or {}
            if p.get('src'): out += f'.ph.ph[data-v="{r["pv"]}"]{{background-image:url("{p["src"]}");--ar:{r["ar"]}}}\n'
            t = dict(r['thumb'] or {})
            if not t.get('src') and p.get('src'): t = {'src': p['src'], 'x': 50, 'y': 12, 'z': 1}
            out += img_rule(f'.ph[data-v="{r["tv"]}"]', t)
    return out


def dot(b): return f'<i class="dot" style="--d:{b["c"]}"></i>'


def widget(B):
    call = ''.join(f'''<li><a class="cw-row" href="tel:{b["phone"]}"><span class="cw-ic" style="--d:{b["c"]}"><svg><use href="#i-phone"/></svg></span><span class="cw-t"><b>{esc(b["name"])}</b><small>{esc(b["dist"])}</small></span><span class="cw-num">{esc(b["phoneTxt"])}</span></a></li>''' for b in B)
    chat = ''.join(f'''<li><a class="cw-row" href="https://zalo.me/{b["phone"]}" target="_blank" rel="noopener"><span class="cw-ic" style="--d:{b["c"]}"><svg><use href="#i-chat"/></svg></span><span class="cw-t"><b>{esc(b["name"])}</b><small>Zalo · {esc(b["phoneTxt"])}</small></span><svg class="cw-go"><use href="#arrow"/></svg></a></li>''' for b in B)
    return f'''<div class="cw" id="cw">
  <div class="cw-panel" id="cwCall" role="dialog" aria-labelledby="cwCallT" hidden>
    <div class="cw-head"><div><p class="cw-eyebrow">Gọi đặt phòng</p><p class="cw-title" id="cwCallT">Chọn chi nhánh để gọi</p></div><button class="cw-x" type="button" data-cw-close aria-label="Đóng"><svg><use href="#i-close"/></svg></button></div>
    <ul class="cw-list">{call}</ul>
    <p class="cw-foot">Mở cửa 24/7 · bấm vào chi nhánh để gọi</p>
  </div>
  <div class="cw-panel" id="cwChat" role="dialog" aria-labelledby="cwChatT" hidden>
    <div class="cw-head"><div><p class="cw-eyebrow">Nhắn tin</p><p class="cw-title" id="cwChatT">Nhắn cho chi nhánh nào?</p></div><button class="cw-x" type="button" data-cw-close aria-label="Đóng"><svg><use href="#i-close"/></svg></button></div>
    <a class="cw-mess" href="https://m.me/qhome.staycation" target="_blank" rel="noopener"><span class="cw-ic cw-ic-mess"><svg><use href="#i-chat"/></svg></span><span class="cw-t"><b>Messenger fanpage</b><small>Fanpage chung của Qhome</small></span><svg class="cw-go"><use href="#arrow"/></svg></a>
    <ul class="cw-list">{chat}</ul>
  </div>
  <div class="cw-btns">
    <button class="cw-btn cw-btn-chat" type="button" id="cwChatBtn" aria-expanded="false" aria-controls="cwChat"><svg class="ic"><use href="#i-chat"/></svg><svg class="x"><use href="#i-close"/></svg><span class="cw-tip">Nhắn tin</span></button>
    <button class="cw-btn cw-btn-call" type="button" id="cwCallBtn" aria-expanded="false" aria-controls="cwCall"><svg class="ic"><use href="#i-phone"/></svg><svg class="x"><use href="#i-close"/></svg><span class="cw-tip">Gọi chi nhánh</span></button>
  </div>
</div>'''


def hotlines(B):
    return ''.join(f'''<li>{dot(b)}<span class="hl-name"><b>{esc(b["name"])}</b><small>{esc(b["addr"])}</small></span><span class="hl-phone">{esc(b["phoneTxt"])}</span><span class="hl-act"><button class="copy-btn" type="button" data-copy="{b["phone"]}">Sao chép</button><a class="copy-btn" href="tel:{b["phone"]}">Gọi</a><a class="copy-btn" href="https://zalo.me/{b["phone"]}" target="_blank" rel="noopener">Zalo</a></span></li>''' for b in B)


def br_tabs(B):
    return ''.join(f'<button class="br-tab" role="tab" id="brTab{i}" aria-selected="{"true" if i == 0 else "false"}" aria-controls="brPanel" tabindex="{0 if i == 0 else -1}" data-i="{i}" style="--d:{b["c"]}"><span class="n">{b["n"]}</span><span class="t"><b>{dot(b)}{esc(b["name"])}</b><small>{esc(b["dist"])}</small></span><svg class="go"><use href="#arrow"/></svg></button>' for i, b in enumerate(B))


def js_data(B):
    keys = ('n', 'name', 'dist', 'addr', 'phone', 'phoneTxt', 'map', 'c', 'ink', 't', 'v', 'rows', 'notes', 'feat', 'slug', 'soon')
    return [dict({k: b[k] for k in keys}, rooms=[{k: r[k] for k in ('no', 'tier', 'm2', 'ar', 'pv', 'tv')} for r in b['rooms']]) for b in B]
