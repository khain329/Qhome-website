"""Build Qhome site.
Outputs:
  site/                 bản deploy (GitHub/Netlify): index.html, cau-chuyen.html, assets/
  index.html            bản xem trước cho Artifact (trang chủ, không có khung <html>)
"""
import json, re, os, shutil, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.environ['QH_ROOT'] = ROOT
sys.path.insert(0, os.path.join(ROOT, 'src'))
import content as CT
P = json.load(open(f'{ROOT}/src/parts.json', encoding='utf-8'))
P['badge'] = ''  # đã bỏ nhãn "Mockup · ảnh & giá tạm"
C = CT.load_content()
B = CT.normalize(C['branches'])
TIERS = CT.TIERS
esc = CT.esc

def dot(b): return f'<i class="dot" style="--d:{b["c"]}"></i>'
ARROW = '<svg><use href="#arrow"/></svg>'
HOME_URL = 'index.html'

# ---------------- shared chrome ----------------
SITE_URL = (os.environ.get('URL') or 'https://mottrainghiem.netlify.app').rstrip('/')
GA_ID = 'G-L86S7QWH19'
PAGE_PATH = {'home': '/', 'story': '/cau-chuyen', 'rooms': '/phong', 'faq': '/faq'}
def abs_url(src):
    if not src: return f'{SITE_URL}/assets/og-qhome.jpg'
    if src.startswith('http'): return src
    return SITE_URL + '/' + src.lstrip('/')
def price_range(b):
    vals = [v for _, row in b['rows'] for v in row if v]
    return f'{money(min(vals))}₫ – {money(max(vals))}₫' if vals else None
def lodging_ld(b):
    d = {'@type': 'LodgingBusiness', 'name': f'Q Home {b["name"]}', 'url': f'{SITE_URL}/{b["slug"]}',
         'telephone': '+84' + b['phone'][1:] if b['phone'].startswith('0') else b['phone'],
         'address': {'@type': 'PostalAddress', 'streetAddress': b['addr'], 'addressLocality': 'Thành phố Hồ Chí Minh', 'addressCountry': 'VN'},
         'image': abs_url((b['cover'] or {}).get('src')), 'hasMap': b['map'] if b['map'] != '#' else None,
         'openingHoursSpecification': {'@type': 'OpeningHoursSpecification', 'dayOfWeek': ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'], 'opens': '00:00', 'closes': '23:59'},
         'priceRange': price_range(b), 'description': b['desc'] or None,
         'amenityFeature': [{'@type': 'LocationFeatureSpecification', 'name': f, 'value': True} for f in b['feat']] or None,
         'brand': {'@type': 'Brand', 'name': 'Q Home Staycation'}}
    return {k: v for k, v in d.items() if v is not None}
def seo_ld(page):
    if page == 'home':
        data = {'@context': 'https://schema.org', '@graph': [
            {'@type': 'Organization', 'name': 'Q Home Staycation', 'url': SITE_URL + '/', 'logo': f'{SITE_URL}/assets/logo-512.png',
             'sameAs': ['https://www.facebook.com/qhome.staycation', 'https://www.instagram.com/qhome.staycation/', 'https://www.tiktok.com/@qhome.staycation']},
            *[lodging_ld(b) for b in B if not b['soon']]]}
    else:
        bi = next((i for i, b in enumerate(B) if b['slug'] == page), None)
        if bi is None or B[bi]['soon']: return ''
        data = dict({'@context': 'https://schema.org'}, **lodging_ld(B[bi]))
    return '<script type="application/ld+json">' + json.dumps(data, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'
GA_TAG = ('<script>(function(){var h=location.hostname;if(!/\\./.test(h)||/^(localhost|127\\.)/.test(h)||(/[?&]admin\\b/.test(location.search)&&window.parent!==window))return;'
          'var s=document.createElement("script");s.async=1;s.src="https://www.googletagmanager.com/gtag/js?id=' + GA_ID + '";document.head.appendChild(s);'
          'window.dataLayer=window.dataLayer||[];window.gtag=function(){dataLayer.push(arguments)};gtag("js",new Date());gtag("config","' + GA_ID + '");})();</script>\n')

def head(title, desc, page='home', rooms_for=None, image=None):
    pj = json.dumps(C['pages'].get(page, {}), ensure_ascii=False).replace('</', '<\\/')
    url = SITE_URL + PAGE_PATH.get(page, '/' + page)
    img = image or f'{SITE_URL}/assets/og-qhome.jpg'
    extra = '<style id="qh-img">\n' + CT.image_css(B, rooms_for) + '</style>\n<script type="application/json" id="qh-content">' + pj + '</script>\n'
    extra = (f'<link rel="canonical" href="{url}">\n<meta property="og:type" content="website">\n<meta property="og:site_name" content="Q Home Staycation">\n'
             f'<meta property="og:locale" content="vi_VN">\n<meta property="og:title" content="{esc(title)}">\n<meta property="og:description" content="{esc(desc)}">\n'
             f'<meta property="og:url" content="{url}">\n<meta property="og:image" content="{img}">\n<meta name="twitter:card" content="summary_large_image">\n'
             + seo_ld(page) + GA_TAG + extra)
    return f'''<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@300;400;500;600&family=Fraunces:ital,opsz,wght@0,9..144,300..600;1,9..144,300..500&display=swap">
<link rel="stylesheet" href="assets/style.css">
{extra}</head>
'''

def links(page):
    home = page == 'home'
    h = '' if home else HOME_URL
    return dict(
        brand='#top' if home else HOME_URL,
        story='cau-chuyen.html',
        rooms='phong.html', faq='faq.html', contact=f'{h}#lien-he', branches=f'{h}#chi-nhanh',
        cn=lambda i: f'{B[i]["slug"]}.html')

def header(page, bi=None):
    L = links(page)
    cur = ' aria-current="page"' if page == 'story' else ''
    rcur = ' aria-current="page"' if page == 'rooms' else ''
    fcur = ' aria-current="page"' if page == 'faq' else ''
    ac = lambda i: ' aria-current="page"' if bi == i else ''
    dd_items = ''.join(f'<li><a class="dd-item" href="{L["cn"](i)}"{ac(i)}><span class="n">{b["n"]}</span><span><b>{dot(b)}{esc(b["name"])}</b><small>{esc(b["dist"])}</small></span><svg class="go"><use href="#arrow"/></svg></a></li>' for i, b in enumerate(B))
    return f'''<header class="site" id="top">
  <div class="wrap nav">
    <a class="brand" href="{L["brand"]}" aria-label="Q Home – trang chủ">
      <span class="brand-mark"><svg><use href="#qmark"/></svg></span>
      <span class="brand-name">Q Home<small>Một trải nghiệm</small></span>
    </a>
    <nav class="nav-links" aria-label="Điều hướng chính">
      <a href="{L["story"]}"{cur}>Câu chuyện</a>
      <a href="{L["rooms"]}"{rcur}>Phòng</a>
      <a href="{L["faq"]}"{fcur}>Hỏi đáp</a>
      <div class="has-dd" id="dd">
        <button class="dd-toggle{' is-current' if bi is not None else ''}" id="ddToggle" type="button" aria-expanded="false" aria-controls="ddPanel">Chi nhánh <svg><use href="#chev"/></svg></button>
        <div class="dd" id="ddPanel">
          <ul class="dd-list">{dd_items}</ul>
          <div class="dd-preview" id="ddPrev" style="--brc:{B[0]["c"]}"><div class="ph" data-v="{B[0]["v"]}" id="ddPh"></div><span class="dd-cap" id="ddCap">5 chi nhánh</span></div>
        </div>
      </div>
      <a class="btn btn-solid magnetic" href="{L["contact"]}">Liên hệ</a>
    </nav>
    <button class="burger" id="burger" aria-label="Mở menu" aria-expanded="false" aria-controls="mobile-menu"><span></span><span></span></button>
  </div>
</header>
'''

def mobile_menu(page, bi=None):
    L = links(page)
    cur = ' aria-current="page"' if page == 'story' else ''
    rcur = ' aria-current="page"' if page == 'rooms' else ''
    fcur = ' aria-current="page"' if page == 'faq' else ''
    items = ''.join(f'<a href="{L["cn"](i)}"{" aria-current=\"page\"" if bi == i else ""}><span>{b["n"]}</span>{b["name"]}<small>{b["dist"]}</small></a>' for i, b in enumerate(B))
    return f'''<div class="mobile-menu" id="mobile-menu" aria-hidden="true">
  <nav aria-label="Menu di động">
    <a href="{L["story"]}"{cur}>Câu chuyện</a>
    <a href="{L["rooms"]}"{rcur}>Phòng</a>
    <a href="{L["faq"]}"{fcur}>Hỏi đáp</a>
    <button class="mm-acc" id="mmAcc" type="button" aria-expanded="false" aria-controls="mmSub">Chi nhánh <svg><use href="#chev"/></svg></button>
    <div class="mm-sub" id="mmSub" hidden>{items}</div>
    <a href="{L["contact"]}"><em>Liên hệ</em></a>
  </nav>
  <div class="mm-foot"><span>5 chi nhánh · Mở cửa 24/7</span><span>Hotline riêng từng chi nhánh ở mục Liên hệ</span></div>
</div>
'''

def footer(page):
    L = links(page)
    br = ''.join(f'<a href="{L["cn"](i)}">{dot(b)}{b["name"]}</a>' for i, b in enumerate(B))
    extra = '<button class="replay" id="replayCurtain" type="button">Xem lại màn kéo rèm</button>' if page == 'home' else f'<a class="replay" href="{HOME_URL}">Về trang chủ</a>'
    return f'''<footer class="on-dark">
  <div class="wrap">
    <div class="foot">
      <div>
        <a class="brand" href="{L["brand"]}"><span class="brand-mark"><svg><use href="#qmark"/></svg></span><span class="brand-name">Q Home<small>Một trải nghiệm</small></span></a>
        <p style="margin-top:18px;max-width:36ch">Staycation ấm cúng với 5 chi nhánh. Mở cửa 24/7.</p>
        <p style="margin-top:14px"><a href="{L["story"]}">Câu chuyện Qhome</a></p>
        <p style="margin-top:6px"><a href="{L["faq"]}">Hỏi đáp &amp; nội quy lưu trú</a></p>
      </div>
      <div>
        <h4>Chi nhánh</h4>
        {br}
        <p style="margin-top:12px;word-break:break-all">qhome.mottrainghiem@gmail.com</p>
      </div>
      <div>
        <h4>Theo dõi</h4>
        <a href="https://www.facebook.com/qhome.staycation" target="_blank" rel="noopener">Facebook</a>
        <a href="https://www.instagram.com/qhome.staycation/" target="_blank" rel="noopener">Instagram</a>
        <a href="https://www.tiktok.com/@qhome.staycation" target="_blank" rel="noopener">TikTok</a>
      </div>
    </div>
    <div class="foot-bottom"><span>© <span id="yr">2026</span> Q Home – Một Trải Nghiệm</span><span class="foot-acts">{extra}<button class="to-top" type="button" data-top aria-label="Lên đầu trang">Lên đầu trang <span class="to-top-ic"><svg><use href="#arrow"/></svg></span></button></span></div>
  </div>
</footer>
'''

SCRIPTS = '''<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/gsap.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.5/ScrollTrigger.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/lenis@1.1.13/dist/lenis.min.js"></script>
<script src="assets/main.js"></script>
'''

# ---------------- home ----------------
def money(k): return f'{k*1000:,}'.replace(',', '.')

def tier_cards():
    pv = {'Standard': ('p-std', 'Standard 201 · Thích Quảng Đức'), 'Deluxe': ('p-dlx', 'Deluxe 204 · Thích Quảng Đức'),
          'Premium': ('p-prm', 'Premium 301 · Sư Vạn Hạnh'), 'Suite': ('p-ste', 'Suite 302 · Sư Vạn Hạnh')}
    desc = {'Standard': 'Phòng gọn gàng, mức giá dễ chịu nhất. Phòng 20m² ở Thích Quảng Đức có máy chiếu 100 inch.',
            'Deluxe': 'Hạng phòng có ở cả 5 chi nhánh, mỗi phòng một bảng màu riêng. Lựa chọn quen thuộc cho một tối thư giãn.',
            'Premium': 'Rộng hơn, nhiều góc ngồi và chi tiết trang trí hơn. Nhiều phòng có sofa riêng.',
            'Suite': 'Hạng cao nhất, có bồn tắm nằm. Có ở Sư Vạn Hạnh và Ba Tháng Hai.'}
    out = []
    for k, t in enumerate(TIERS):
        rs = [(b, r) for b in B for r in b['rooms'] if r['tier'] == t]
        brs = [b for b in B if any(row[0] == t for row in b['rows'])]
        m2 = sorted({r['m2'] for _, r in rs if r['m2']})
        size = (f'{m2[0]}m²' if len(m2) == 1 else f'{m2[0]}–{m2[-1]}m²') if m2 else ''
        low = min(row[1][0] for b in B for row in b['rows'] if row[0] == t)
        chips = ''.join(
            f'<a class="tier-chip" style="--brc:{b["c"]}" href="{b["slug"]}.html" title="{esc(b["name"])} sắp mở cửa">{dot(b)}<span>{esc(b["name"])}</span><svg class="tc-arr"><use href="#arrow"/></svg></a>' if b['soon'] else
            f'<a class="tier-chip" style="--brc:{b["c"]}" href="phong.html#{b["slug"]}:{t.lower()}" aria-label="Xem phòng {t} tại {esc(b["name"])}">{dot(b)}<span>{esc(b["name"])}</span><svg class="tc-arr"><use href="#arrow"/></svg></a>'
            for b in brs)
        v, cap = pv[t]
        meta = f'<span>{len(rs)}+ phòng</span>' + (f'<span>{size}</span>' if size else '')
        out.append(f'''
          <article class="room">
            <div class="room-media"><div class="ph" data-v="{v}" role="img" aria-label="{cap}"></div><div class="room-info"><span class="room-no">HẠNG 0{k+1}</span><h3>{t}</h3><p>{desc[t]}</p><div class="room-meta">{meta}</div></div></div>
            <div class="tags-wrap"><p class="tags-t">Có tại</p><div class="tags" aria-label="Có tại các chi nhánh">{chips}</div></div>
            <div class="room-foot"><span>Từ <b>{money(low)}đ</b> · combo 2H</span><a href="#chi-nhanh">Bảng giá {ARROW.replace('<svg>', '<svg width="14" height="14">')}</a></div>
          </article>''')
    return ''.join(out)

def home_main():
    m = P['main']
    # thẻ hạng phòng
    a = m.index('<div class="rooms-track">') + len('<div class="rooms-track">'); b = m.index('<div class="room-end">')
    m = m[:a] + tier_cards() + '\n          ' + m[b:]
    m = m.replace('<div class="wrap"><div class="rooms-progress"><i></i></div></div>', '<div class="wrap rooms-ctrl"><div class="rooms-progress"><i></i></div><div class="rooms-arrows"><button class="rooms-arrow" id="roomsPrev" type="button" aria-label="Hạng phòng trước"><svg><use href="#arrow"/></svg></button><button class="rooms-arrow" id="roomsNext" type="button" aria-label="Hạng phòng sau"><svg><use href="#arrow"/></svg></button></div></div>', 1)
    # gallery & door: ảnh thật
    G = [('g1', 'p-ste', 'Bồn tắm · Suite 302 Sư Vạn Hạnh'), ('g2', 'p-32', 'Bồn tắm giữa vườn · Ba Tháng Hai'),
         ('g3', 'p-jungle', 'Bồn tắm đá · Suite 401 Ba Tháng Hai'), ('g4', 'p-wave', 'Gương lượn sóng · Premium 402 Ba Tháng Hai'),
         ('g5', 'p-bc2', 'Tường gỗ · Premium 302 Bàu Cát'), ('g6', 'p-tqd', 'Góc ghế vàng · Premium 102 Thích Quảng Đức'),
         ('g7', 'p-svhlv', 'Phòng khách · Premium 401 Sư Vạn Hạnh')]
    for g, v, cap in G:
        m = re.sub(r'<button class="g-item ' + g + r'"[^>]*>.*?<span class="zoom">',
                   f'<button class="g-item {g}" data-reveal data-v="{v}" data-cap="{cap}" aria-label="Xem ảnh: {cap}"><div class="ph" data-v="{v}"></div><span class="zoom">', m, count=1, flags=re.S)
    m = m.replace('<div class="door-frame"><div class="ph" data-v="hello"></div></div>', '<div class="door-frame"><div class="ph" data-v="p-door"></div></div>')
    m = m.replace('Bấm vào ảnh để xem lớn. Trên điện thoại, vuốt sang để xem ảnh tiếp theo.', 'Ảnh thật từ các phòng của Qhome. Bấm vào ảnh để xem lớn, vuốt sang để xem ảnh tiếp theo.')
    # tiện nghi
    m = m.replace('<h3>Bồn tắm thư giãn</h3><p>Ngâm mình trong nước ấm, bật một bản nhạc, để cả ngày dài trôi đi.</p>',
                  '<h3>Bồn tắm thư giãn</h3><p>Các phòng Suite ở Sư Vạn Hạnh và Ba Tháng Hai có bồn tắm nằm. Ngâm mình thật lâu, để cả ngày dài trôi đi.</p>')
    m = m.replace('<h3>Ngủ ngon</h3><p>Chăn gối mềm, rèm dày, ánh đèn dịu. Mọi thứ để bạn ngủ sâu hơn ở nhà.</p>',
                  '<h3>Màn hình lớn &amp; Netflix</h3><p>TV 65–75 inch hoặc máy chiếu 100 inch, có sẵn Netflix và YouTube Premium cho một tối xem phim.</p>')
    m = m.replace('<h3>Góc chụp ảnh</h3><p>Gương lượn sóng, tranh màu cam, đèn giấy. Góc nào cũng lên hình đẹp.</p>',
                  '<h3>Góc chụp ảnh</h3><p>Gương lượn sóng, tranh nghệ thuật, mỗi phòng một bảng màu riêng. Góc nào cũng lên hình đẹp.</p>')
    # khối phụ thuộc dữ liệu chi nhánh
    m = re.sub(r'<div class="br-list" role="tablist" aria-label="Chọn chi nhánh" data-reveal>.*?</div>\s*<article', lambda mo: '<div class="br-list" role="tablist" aria-label="Chọn chi nhánh" data-reveal>' + CT.br_tabs(B) + '</div>\n        <article', m, count=1, flags=re.S)
    m = re.sub(r'(<ul class="hotlines" data-reveal aria-label="Hotline từng chi nhánh">).*?(</ul>)', lambda mo: mo.group(1) + CT.hotlines(B) + mo.group(2), m, count=1, flags=re.S)
    m = re.sub(r'(<section class="section loc" id="chi-nhanh" style=")[^"]*(")', lambda mo: mo.group(1) + f'--brc:{B[0]["c"]};--bron:{B[0]["ink"]};--brt:{B[0]["t"]}' + mo.group(2), m, count=1)
    # danh sách phòng trong thẻ chi nhánh
    b0 = B[0]
    rooms_html = f'''
          <div class="br-rooms br-feat">
            <ul class="pfeat" id="brFeat" aria-label="Tiện ích"></ul>
          </div>'''
    m = m.replace('<a class="btn btn-line magnetic" id="brCall" href="tel:', f'<a class="btn btn-line magnetic" id="brPage" href="{B[0]["slug"]}.html">Xem trang chi nhánh</a>\n                <a class="btn btn-line magnetic" id="brCall" href="tel:', 1)
    anchor = '<ul class="pnotes" id="brNotes">'
    i = m.index(anchor); j = m.index('</div>', m.index('</ul>', i)) + len('</div>')
    m = m[:j] + rooms_html + m[j:]
    # nút dẫn sang trang Phòng từ mục Hạng phòng
    m = re.sub(r'(<section class="rooms on-dark" id="phong">.*?<div class="wrap rooms-head">.*?)<p data-reveal>(.*?)</p>', lambda mo: mo.group(1) + f'<div class="rooms-head-side" data-reveal><p>{mo.group(2)}</p><a class="btn btn-line magnetic rooms-all" href="phong.html">Xem phòng từng chi nhánh {ARROW}</a></div>', m, count=1, flags=re.S)
    # nút dẫn sang trang Câu chuyện
    i = m.index('<div class="facts" data-reveal>'); j = i
    for _ in range(4): j = m.index('</div>', j) + len('</div>')
    m = m[:j] + f'\n        <a class="btn btn-line magnetic home-story-link" href="cau-chuyen.html" data-reveal>Đọc câu chuyện Qhome {ARROW}</a>' + m[j:]
    return m

def page_home():
    body = (f'<body data-page="home">\n{P["defs"]}\n\n{P["curtain"]}\n\n{P["badge"]}\n\n{header("home")}\n{mobile_menu("home")}\n'
            f'{home_main()}\n\n{footer("home")}\n{P["lightbox"]}\n\n{CT.widget(B)}\n\n{P["toast"]}\n\n{SCRIPTS}</body>\n</html>\n')
    return head('Qhome Staycation · Staycation Sài Gòn, 5 chi nhánh mở cửa 24/7', 'Q Home Staycation: 5 chi nhánh staycation tại TP.HCM (' + ', '.join(dict.fromkeys(b['dist'] for b in B)) + '). Phòng theo giờ, qua đêm và theo ngày, mỗi phòng một bảng màu riêng. Mở cửa 24/7.', 'home', -1) + body

# ---------------- story ----------------
HOMES = {
    'Bàu Cát': ('Sáng, sạch và đầy màu', 'Phòng trắng sáng, đầu giường nhung và gạch ốp mỗi phòng một màu: đỏ, hồng, xanh rêu, xanh navy. 10 phòng Deluxe và Premium.'),
    'Sư Vạn Hạnh': ('Rộng rãi, tối giản, có bồn tắm', 'Phòng rộng 20–32m², tường trắng, sàn gỗ và tranh nghệ thuật. Ba phòng Suite có bồn tắm nằm và ban công.'),
    'Ba Tháng Hai': ('Một khu vườn trong phòng', 'Gương lượn sóng, tường sọc và ban công ở hầu hết các phòng. Suite 401 có bồn tắm đá giữa vườn cây. Chi nhánh duy nhất có đủ bốn hạng phòng.'),
    'Lê Đại Hành': ('Ấm như phòng khách nhà mình', 'Sofa xanh rêu, rèm vải mỏng và đèn ngủ vàng. Gần gũi, giản dị, ngay giữa Quận 11.'),
    'Thích Quảng Đức': ('Mỗi phòng một sắc màu', 'Tường hồng, cam, xanh rêu và máy chiếu 100 inch. Có bếp chung, bãi đậu xe hơi và khu vườn có ghế ngồi, trong hẻm yên tĩnh ở Phú Nhuận.'),
}
def hcards():
    out = []
    for i, b in enumerate(B):
        tag, desc = b['tagline'], b['desc']
        tiers = ''.join(f'<span>{r[0]}</span>' for r in b['rows'])
        label = ''
        out.append(f'''      <article class="hcard" style="--i:{i};--hc:{b["c"]};--hink:{b["ink"]}">
        <div class="hcard-text">
          <div>
            <span class="n">CHI NHÁNH {b["n"]} · {b["dist"].upper()}{(' · ' + str(len(b['rooms'])) + ' PHÒNG') if not b['soon'] else ''}</span>
            <h3>{b["name"]}</h3>
            <p class="tag">{tag}</p>
          </div>
          <div>
            <p>{desc}</p>
            <div class="tiers" aria-label="Hạng phòng">{tiers}</div>
          </div>
          <a class="go" href="{b['slug']}.html">{'Sắp ra mắt' if b['soon'] else 'Xem phòng &amp; bảng giá'} {ARROW}</a>
        </div>
        <div class="hcard-media"><div class="ph" data-v="{b["v"]}" style="--brc:{b["c"]}">{label}</div></div>
      </article>''')
    return '\n'.join(out)

def story_main():
    return f'''<main>
  <!-- HERO -->
  <section class="s-hero">
    <div class="wrap s-hero-grid">
      <div class="s-hero-copy">
        <p class="eyebrow" data-load>Câu chuyện · Q Home</p>
        <h1 class="display">
          <span class="line"><span>Một chiếc nhà</span></span>
          <span class="line"><span>mà bọn mình</span></span>
          <span class="line"><span>gọi là <span class="ital">Home.</span></span></span>
        </h1>
        <p class="lede" data-load>Q Home bắt đầu từ một ý nghĩ rất đơn giản: giữa Sài Gòn bận rộn, ai cũng cần một nơi để về. Không phải khách sạn, cũng không hẳn là nhà mình. Một chốn đủ quen để thả lỏng, đủ lạ để thấy mình đang được nghỉ.</p>
        <div class="s-meta" data-load>
          <div><b>5</b><span>ngôi nhà</span></div>
          <div><b>40+</b><span>phòng nghỉ</span></div>
          <div><b>24/7</b><span>luôn mở cửa</span></div>
        </div>
      </div>
      <div class="arch s-hero-arch"><div class="ph" data-v="p-ldh" style="--pos:40% 50%" role="img" aria-label="Phòng nghỉ chi nhánh Lê Đại Hành"></div></div>
    </div>
  </section>

  <!-- LOGO -->
  <section class="s-logo on-dark" aria-labelledby="logoT">
    <div class="s-logo-pin">
      <div class="wrap s-logo-grid">
        <div class="s-mark">
          <svg viewBox="-90 -30 660 1240" role="img" aria-label="Logo Q Home: chữ Q là một ô cửa vòm, góc dưới là mái nhà có ô cửa sổ, bên dưới là chữ HOME">
            <defs>
              <linearGradient id="cuL" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="516" y2="0"><stop offset="0" stop-color="#EBCB9B"/><stop offset=".5" stop-color="#D3AD7F"/><stop offset="1" stop-color="#BE9367"/></linearGradient>
              <radialGradient id="archGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#E59A4B" stop-opacity=".22"/><stop offset="1" stop-color="#E59A4B" stop-opacity="0"/></radialGradient>
            </defs>
            <rect class="glow" x="20" y="40" width="476" height="820" rx="238"/>
            <path class="stroke s-arch" pathLength="1" d="M355.0 975.4C321.4 972.4 291.1 960.8 264.5 940.6C259.9 937.1 225.6 903.7 183.4 861.5C143.1 821.4 109.3 787.6 108.1 786.6L105.9 784.6L53.0 837.5L0.0 890.5L0.0 867.6L0.0 844.7L64.2 780.4L128.5 716.2L223.8 811.3L319.2 906.5L323.2 902.0C333.0 891.1 346.0 867.6 349.5 854.5C350.4 851.2 351.7 846.2 352.4 843.5C356.2 829.4 356.2 828.5 355.8 478.5L355.5 137.5L352.6 126.1C344.1 91.5 328.0 66.8 300.7 46.4C287.7 36.7 274.3 29.9 256.0 24.0C236.6 17.6 229.8 16.6 209.5 16.5C190.3 16.5 180.0 18.3 161.9 24.6C137.4 33.1 120.3 43.6 104.0 59.9C85.5 78.4 74.0 99.3 67.2 126.8L64.5 137.5L64.3 437.0L64.0 736.5L32.7 767.8C15.6 784.9 1.2 799.0 0.8 799.0C0.3 799.0 0.0 655.8 0.0 480.8C0.0 203.0 0.2 161.2 1.5 152.5C6.5 119.4 19.1 90.7 39.6 65.9C45.4 59.0 50.6 54.0 63.6 43.0C80.6 28.7 116.2 12.7 143.5 7.1C180.0 -0.3 220.5 -1.6 256.0 3.6C311.6 11.7 355.3 34.7 383.9 71.0C398.2 89.1 404.1 100.5 412.6 126.9C420.1 150.3 419.5 119.1 419.5 485.5L419.5 813.5L416.8 826.1C408.3 865.2 390.8 895.7 362.7 920.1L355.9 926.0L358.7 927.1C364.2 929.2 380.1 932.9 388.7 934.1C406.9 936.5 431.6 933.5 451.0 926.5C469.7 919.7 490.3 908.0 502.4 897.2L506.2 893.8L511.1 898.6C513.8 901.3 516.0 903.9 516.0 904.5C516.0 906.6 488.2 930.0 476.0 938.1C452.7 953.6 441.4 959.4 420.5 966.5C401.7 973.0 372.3 976.9 355.0 975.4Z"/>
            <path class="stroke s-roof" pathLength="1" d="M94.7 863.1C88.8 857.1 84.0 851.8 84.0 851.3C84.0 850.9 89.0 845.6 95.0 839.5L106.0 828.5L117.0 839.5C123.0 845.5 128.0 850.8 128.0 851.2C128.0 852.1 106.8 874.0 106.0 874.0C105.6 874.0 100.5 869.1 94.7 863.1Z"/>
            <path class="s-fill" d="M355.0 975.4C321.4 972.4 291.1 960.8 264.5 940.6C259.9 937.1 225.6 903.7 183.4 861.5C143.1 821.4 109.3 787.6 108.1 786.6L105.9 784.6L53.0 837.5L0.0 890.5L0.0 867.6L0.0 844.7L64.2 780.4L128.5 716.2L223.8 811.3L319.2 906.5L323.2 902.0C333.0 891.1 346.0 867.6 349.5 854.5C350.4 851.2 351.7 846.2 352.4 843.5C356.2 829.4 356.2 828.5 355.8 478.5L355.5 137.5L352.6 126.1C344.1 91.5 328.0 66.8 300.7 46.4C287.7 36.7 274.3 29.9 256.0 24.0C236.6 17.6 229.8 16.6 209.5 16.5C190.3 16.5 180.0 18.3 161.9 24.6C137.4 33.1 120.3 43.6 104.0 59.9C85.5 78.4 74.0 99.3 67.2 126.8L64.5 137.5L64.3 437.0L64.0 736.5L32.7 767.8C15.6 784.9 1.2 799.0 0.8 799.0C0.3 799.0 0.0 655.8 0.0 480.8C0.0 203.0 0.2 161.2 1.5 152.5C6.5 119.4 19.1 90.7 39.6 65.9C45.4 59.0 50.6 54.0 63.6 43.0C80.6 28.7 116.2 12.7 143.5 7.1C180.0 -0.3 220.5 -1.6 256.0 3.6C311.6 11.7 355.3 34.7 383.9 71.0C398.2 89.1 404.1 100.5 412.6 126.9C420.1 150.3 419.5 119.1 419.5 485.5L419.5 813.5L416.8 826.1C408.3 865.2 390.8 895.7 362.7 920.1L355.9 926.0L358.7 927.1C364.2 929.2 380.1 932.9 388.7 934.1C406.9 936.5 431.6 933.5 451.0 926.5C469.7 919.7 490.3 908.0 502.4 897.2L506.2 893.8L511.1 898.6C513.8 901.3 516.0 903.9 516.0 904.5C516.0 906.6 488.2 930.0 476.0 938.1C452.7 953.6 441.4 959.4 420.5 966.5C401.7 973.0 372.3 976.9 355.0 975.4ZM94.7 863.1C88.8 857.1 84.0 851.8 84.0 851.3C84.0 850.9 89.0 845.6 95.0 839.5L106.0 828.5L117.0 839.5C123.0 845.5 128.0 850.8 128.0 851.2C128.0 852.1 106.8 874.0 106.0 874.0C105.6 874.0 100.5 869.1 94.7 863.1Z"/>
            <path class="s-word" d="M65.0 1112.9L65.0 1042.0L68.4 1042.0C72.9 1042.0 78.2 1045.8 79.7 1050.0C80.4 1052.2 80.9 1060.2 80.9 1071.2L81.0 1088.9L84.8 1088.3C94.3 1086.9 95.5 1086.4 97.8 1083.0C99.9 1079.9 100.0 1078.7 99.9 1065.6C99.9 1057.8 100.3 1050.3 100.9 1048.8C102.2 1045.3 107.5 1042.0 111.8 1042.0L115.0 1042.0L115.0 1112.8L115.0 1183.5L107.5 1183.5C103.2 1183.5 100.0 1183.1 100.0 1182.5C100.0 1182.0 100.0 1161.2 100.0 1136.3C100.0 1111.4 99.7 1090.9 99.2 1090.7C98.8 1090.4 95.4 1090.8 91.6 1091.5C80.3 1093.6 81.0 1090.2 81.0 1140.5L81.0 1183.5L73.0 1183.6L65.0 1183.7L65.0 1112.9ZM202.4 1183.1C202.2 1182.9 202.0 1151.0 202.0 1112.3L202.0 1042.0L205.0 1042.0C206.7 1042.0 209.4 1042.7 211.1 1043.5C213.7 1044.9 214.5 1044.9 218.6 1043.5C225.6 1041.1 231.8 1041.6 238.5 1044.9L244.2 1047.8L249.2 1045.2C255.1 1042.1 264.0 1041.2 269.6 1043.0C276.6 1045.3 279.9 1048.2 283.0 1054.5L286.0 1060.5L286.1 1121.5L286.1 1182.5L278.6 1182.8L271.0 1183.1L271.0 1117.2L271.0 1051.3L268.4 1048.6C264.1 1044.3 255.5 1045.5 253.1 1050.7C252.3 1052.4 252.0 1072.6 252.0 1118.0L252.0 1182.8L244.5 1183.2C238.4 1183.4 237.0 1183.2 237.0 1182.0C237.0 1181.2 236.9 1151.4 236.7 1115.8L236.5 1051.2L234.1 1048.6C231.0 1045.3 224.5 1045.0 220.9 1047.9L218.5 1049.8L218.0 1116.5L217.5 1183.2L210.2 1183.3C206.1 1183.4 202.6 1183.3 202.4 1183.1ZM147.5 1181.1C143.3 1179.2 139.2 1175.0 136.2 1169.6C134.7 1166.8 134.5 1161.4 134.2 1115.0C133.9 1059.3 134.0 1058.1 139.2 1050.9C145.6 1042.0 160.4 1039.2 171.1 1044.8C175.7 1047.2 177.0 1048.5 179.7 1053.9L183.0 1060.2L183.0 1111.8C182.9 1152.6 182.6 1164.3 181.6 1167.3C177.8 1177.9 170.3 1183.0 158.6 1183.0C153.9 1183.0 150.1 1182.3 147.5 1181.1ZM318.1 1180.4C312.3 1177.5 309.3 1173.6 306.6 1165.4C305.1 1160.7 304.9 1155.1 305.2 1110.4C305.5 1060.7 305.5 1060.5 307.8 1055.8C312.4 1046.6 318.0 1042.9 328.7 1042.2C335.1 1041.8 336.6 1042.1 341.4 1044.4C345.2 1046.3 347.7 1048.4 349.8 1051.5C354.5 1058.6 355.2 1064.5 354.8 1093.0C354.5 1117.1 354.4 1118.8 352.2 1123.5C351.0 1126.2 349.2 1129.3 348.2 1130.3C345.7 1133.1 340.1 1135.7 334.7 1136.5C330.5 1137.2 330.0 1137.0 330.0 1135.3C330.0 1133.9 331.0 1133.1 333.8 1132.4C336.8 1131.7 337.7 1130.8 338.7 1128.0C340.3 1123.4 340.5 1055.7 339.0 1051.3C337.0 1045.7 327.9 1044.0 323.5 1048.5L321.0 1050.9L321.0 1112.5L321.0 1174.1L323.5 1176.5C325.3 1178.4 327.0 1179.0 330.3 1179.0C335.8 1179.0 338.6 1176.2 339.6 1170.0C340.9 1161.5 344.6 1157.3 351.2 1156.8C354.5 1156.5 354.5 1156.5 354.3 1160.5C354.0 1165.1 352.6 1168.9 349.3 1174.2C344.0 1182.8 329.0 1185.8 318.1 1180.4ZM165.5 1176.5L168.0 1174.1L168.0 1113.5C168.0 1069.3 167.7 1052.3 166.8 1050.7C165.0 1047.3 162.8 1046.1 158.4 1046.0C155.3 1046.0 153.8 1046.6 151.9 1048.6L149.5 1051.2L149.2 1109.8C149.0 1142.1 149.2 1169.9 149.5 1171.6C150.4 1176.6 153.4 1179.0 158.6 1179.0C162.0 1179.0 163.7 1178.4 165.5 1176.5Z"/>
            <g class="pin pin1"><circle cx="-48" cy="360" r="26"/><text x="-48" y="360">1</text></g>
            <g class="pin pin2"><circle cx="-48" cy="830" r="26"/><text x="-48" y="830">2</text></g>
            <g class="pin pin3"><circle cx="0" cy="1112" r="26"/><text x="0" y="1112">3</text></g>
          </svg>
        </div>
        <div class="s-logo-text">
          <p class="eyebrow">Ý nghĩa logo</p>
          <h2 class="display" id="logoT">Chữ Q là <em>một ô cửa.</em></h2>
          <ol class="s-notes">
            <li class="s-note"><span class="n">1</span><div><h3>Ô cửa vòm</h3><p>Chữ Q được vẽ thành một ô cửa vòm. Bước qua cánh cửa ấy là bước vào nhà, để lại phía sau tiếng còi xe và lịch hẹn.</p></div></li>
            <li class="s-note"><span class="n">2</span><div><h3>Mái nhà nhỏ</h3><p>Góc dưới của chữ Q gập lại thành một mái nhà có ô cửa sổ nhỏ. Một lời nhắc rằng ở đây bạn đang về, chứ không phải đi xa.</p></div></li>
            <li class="s-note"><span class="n">3</span><div><h3>HOME</h3><p>Bên dưới là chữ HOME. Mỗi chi nhánh là một ngôi nhà, và bọn mình gọi tất cả là Home.</p></div></li>
          </ol>
        </div>
      </div>
    </div>
  </section>

  <!-- VIDEO -->
  <section class="section s-video" aria-labelledby="videoT">
    <div class="wrap s-video-grid">
      <div class="s-video-copy">
        <p class="eyebrow" data-reveal>Hậu trường</p>
        <h2 class="display" id="videoT" data-split>Mọi trải nghiệm tốt <em>bắt đầu từ một chi tiết nhỏ.</em></h2>
        <p class="lede" data-reveal>Từ những buổi đi tìm chiếc giường chuẩn 5 sao, bảng ý tưởng dán kín tường, đến lúc tự tay khiêng từng tấm nệm vào phòng. Vì với Qhome, chiếc giường là nơi nâng niu cảm xúc của bạn sau một ngày dài.</p>
      </div>
      <div class="s-video-frame" data-reveal>
        <video class="s-vid" id="sVid" src="assets/video/qhome-hau-truong.mp4" poster="assets/video/qhome-hau-truong.webp" playsinline muted loop preload="none" aria-label="Video hậu trường Qhome: đi tìm chiếc giường chuẩn 5 sao"></video>
        <button class="s-vid-play" id="sVidPlay" type="button" aria-label="Phát video"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></button>
        <button class="s-vid-sound" id="sVidSound" type="button" aria-pressed="false" aria-label="Bật tiếng"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z" fill="currentColor"/><path class="on" d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path class="off" d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg></button>
      </div>
    </div>
  </section>

  <!-- MANIFESTO -->
  <section class="s-manifesto">
    <div class="wrap">
      <p class="eyebrow" data-reveal>Điều bọn mình tin</p>
      <p class="s-manifesto-text">Nghỉ ngơi không cần đi xa. Chỉ cần một căn phòng ấm, một ánh đèn vàng, một bồn nước nóng và đủ yên để nghe thấy chính mình. Ở Qhome, bạn được phép <em>dừng lại tất cả, và bắt đầu chữa lành.</em></p>
      <div class="s-pillars">
        <div class="s-pillar" data-reveal><h3>Dừng lại</h3><p>Tắt bớt thông báo, đặt điện thoại xuống. Ở đây không có gì phải vội.</p></div>
        <div class="s-pillar" data-reveal><h3>Thả lỏng</h3><p>Bồn nước ấm, ánh đèn vàng, chăn gối mềm. Mọi thứ được sắp đặt để bạn nghỉ cho thật.</p></div>
        <div class="s-pillar" data-reveal><h3>Trở về</h3><p>Rời Qhome với một cái đầu nhẹ hơn, và một lý do để quay lại.</p></div>
      </div>
    </div>
  </section>

  <!-- FIVE HOMES -->
  <section class="s-homes" aria-labelledby="homesT">
    <div class="wrap">
      <div class="s-homes-head">
        <div>
          <p class="eyebrow" data-reveal>Năm ngôi nhà</p>
          <h2 class="display" id="homesT" data-split>Mỗi nhà <em>một tính cách.</em></h2>
        </div>
        <p class="lede" data-reveal>Cùng một cảm giác về nhà, nhưng mỗi chi nhánh có màu sắc và câu chuyện riêng. Cuộn xuống để gặp từng nhà.</p>
      </div>
      <div class="stack">
{hcards()}
      </div>
    </div>
  </section>

  <!-- A DAY -->
  <section class="section s-day" aria-labelledby="dayT">
    <div class="wrap">
      <p class="eyebrow" data-reveal>Một ngày ở Qhome</p>
      <h2 class="display" id="dayT" data-split>Ghé lúc nào <em>cũng được.</em></h2>
      <div class="day-track">
        <div class="day-line" aria-hidden="true"><i></i></div>
        <div class="day-stop"><time>Mọi lúc</time><b>Combo 2 giờ, 3 giờ</b><p>Ghé nghỉ ngắn giữa ngày, thêm giờ khi cần.</p></div>
        <div class="day-stop"><time datetime="14:00">14:00</time><b>Nhận phòng ngày</b><p>Ở trọn từ đầu giờ chiều đến 11:00 hôm sau.</p></div>
        <div class="day-stop"><time datetime="22:00">22:00</time><b>Nhận phòng qua đêm</b><p>Tắm nước ấm, ngủ một giấc thật sâu.</p></div>
        <div class="day-stop"><time datetime="11:00">11:00</time><b>Trả phòng</b><p>Không cần báo thức sớm. Về nhà với một cái đầu nhẹ hơn.</p></div>
      </div>
    </div>
  </section>

  <!-- CTA -->
  <section class="section s-cta on-dark">
    <div class="contact-glow"></div>
    <div class="wrap s-cta-inner">
      <p class="eyebrow" data-reveal>Hẹn gặp ở nhà</p>
      <h2 class="display" data-split>Về nhà <em>một chút?</em></h2>
      <p data-reveal>Chọn một trong năm ngôi nhà, nhắn hoặc gọi chi nhánh đó. Bọn mình giữ phòng cho bạn.</p>
      <div class="s-cta-actions" data-reveal>
        <a class="btn btn-solid magnetic" href="{HOME_URL}#chi-nhanh">Chọn chi nhánh {ARROW}</a>
        <button class="btn btn-line magnetic" type="button" data-open-cw="call">Gọi đặt phòng</button>
      </div>
    </div>
  </section>
</main>'''

def page_story():
    body = (f'<body data-page="story">\n{P["defs"]}\n\n{P["badge"]}\n\n{header("story")}\n{mobile_menu("story")}\n'
            f'{story_main()}\n\n{footer("story")}\n{CT.widget(B)}\n\n{P["toast"]}\n\n{SCRIPTS}</body>\n</html>\n')
    return head('Câu chuyện Qhome', 'Câu chuyện Q Home – Một Trải Nghiệm: ý nghĩa logo, điều bọn mình tin và năm ngôi nhà.', 'story', -1) + body

# ---------------- branch pages ----------------
def others(bi):
    out = []
    for i, b in enumerate(B):
        if i == bi: continue
        soon = '<span class="soon">Sắp ra mắt</span>' if b['soon'] else ''
        out.append(f'<a class="other" href="{b["slug"]}.html" style="--hc:{b["c"]};--hink:{b["ink"]}">{soon}<div><span class="n">CHI NHÁNH {b["n"]}</span><h3>{b["name"]}</h3><small>{b["dist"]}</small></div><span class="go">Xem chi nhánh {ARROW}</span></a>')
    return f"""  <section class="section bp-others" aria-labelledby="othT">
    <div class="wrap">
      <div class="bp-head"><div><p class="eyebrow" data-reveal>Ghé nhà khác</p><h2 class="display" id="othT" data-split>Bốn ngôi nhà <em>còn lại.</em></h2></div></div>
      <div class="others" data-reveal>{''.join(out)}</div>
    </div>
  </section>"""

def bvars(b): return f'--brc:{b["c"]};--bron:{b["ink"]};--brt:{b["t"]}'

def contact_bits(b):
    return f"""<div class="bp-addr" data-load>
          <b>{b['addr']}</b>
          <span>Hotline <span class="phone-num">{b['phoneTxt']}</span> · Mở cửa 24/7</span>
        </div>
        <div class="bp-actions" data-load>
          <a class="btn btn-solid magnetic" href="{b['map']}" target="_blank" rel="noopener">Chỉ đường {ARROW}</a>
          <a class="btn btn-line magnetic" href="tel:{b['phone']}">Gọi {b['phoneTxt']}</a>
          <a class="btn btn-line magnetic" href="https://zalo.me/{b['phone']}" target="_blank" rel="noopener">Nhắn Zalo</a>
        </div>"""

def branch_main(bi):
    b = B[bi]; tag, desc = b['tagline'], b['desc']
    tiers = [r[0] for r in b['rows']]
    m2 = sorted({r['m2'] for r in b['rooms'] if r['m2']})
    size = (f'{m2[0]}–{m2[-1]}m²' if len(m2) > 1 else f'{m2[0]}m²') if m2 else ''
    low = min(r[1][0] for r in b['rows'])
    rows = ''.join(f'<tr><th scope="row">{t}</th>' + ''.join(f'<td>{money(x)}</td>' for x in v) + '</tr>' for t, v in b['rows'])
    notes = ''.join(f'<li>{x}</li>' for x in b['notes'])
    near = ''.join(f'<li><span>{k}</span><span>{v}</span></li>' for k, v in [('Địa chỉ', b['addr']), ('Hotline', b['phoneTxt']), ('Giờ mở cửa', 'Mở cửa 24/7, nhận khách theo giờ, qua đêm và theo ngày'), ('Tiện ích', ', '.join(b['feat']))])
    return f"""<main class="bp" style="{bvars(b)}">
  <section class="bp-hero">
    <div class="wrap bp-hero-grid">
      <div class="bp-hero-copy">
        <nav class="crumbs" aria-label="Vị trí trang" data-load><a href="{HOME_URL}">Trang chủ</a><span aria-hidden="true">/</span><a href="{HOME_URL}#chi-nhanh">Chi nhánh</a><span aria-hidden="true">/</span><span aria-current="page">{b['name']}</span></nav>
        <p class="eyebrow" data-load>Chi nhánh {b['n']} · {b['dist']}</p>
        <h1 class="display"><span class="line"><span>{b['name']}</span></span></h1>
        <p class="bp-tag" data-load>{tag}</p>
        <p class="lede" data-load>{desc}</p>
        {contact_bits(b)}
      </div>
      <div class="bp-visual"><div class="arch bp-hero-arch"><div class="ph" data-v="{b['v']}" role="img" aria-label="Phòng tại chi nhánh {b['name']}"></div></div></div>
    </div>
    <div class="bp-stats"><div class="wrap">
      <div class="bp-stat"><b>{len(b['rooms'])}</b><span>phòng nghỉ</span></div>
      <div class="bp-stat"><b>{len(tiers)}</b><span>hạng: {', '.join(tiers)}</span></div>
      {f'<div class="bp-stat"><b>{size}</b><span>diện tích phòng</span></div>' if size else '<div class="bp-stat"><b>24/7</b><span>mở cửa mọi ngày</span></div>'}
      <div class="bp-stat"><b>{money(low)}đ</b><span>giá từ, combo 2 giờ</span></div>
    </div></div>
  </section>

  <section class="section" id="cac-phong" aria-labelledby="roomsT">
    <div class="wrap">
      <div class="bp-head">
        <div><p class="eyebrow" data-reveal>Các phòng</p><h2 class="display" id="roomsT" data-split>{len(b['rooms'])} phòng, <em>mỗi phòng một vẻ.</em></h2></div>
        <p class="lede" data-reveal>Bấm vào phòng để xem ảnh chi tiết, dùng mũi tên để xem phòng kế tiếp.</p>
      </div>
      <div class="br-rooms" data-reveal>
        <div class="br-rooms-head"><h4>Các phòng<small id="brRoomCount"></small></h4></div>
        <ul class="pfeat" id="brFeat" aria-label="Tiện ích"></ul>
        <div id="brRooms"></div>
      </div>
    </div>
  </section>

  <section class="section bp-price" id="bang-gia" aria-labelledby="priceT">
    <div class="wrap">
      <div class="bp-head">
        <div><p class="eyebrow" data-reveal>Bảng giá</p><h2 class="display" id="priceT" data-split>Giá phòng <em>{b['name']}.</em></h2></div>
        <p class="lede" data-reveal>Đơn vị: đồng. Giá có thể thay đổi vào dịp lễ, nhắn chi nhánh để có giá chính xác nhất.</p>
      </div>
      <div data-reveal>
        <div class="price-scroll">
          <table class="ptable">
            <caption>Bảng giá phòng chi nhánh {b['name']} · đơn vị: đồng</caption>
            <thead><tr><th scope="col">Hạng phòng</th><th scope="col">Combo 2H</th><th scope="col">Combo 3H</th><th scope="col">Giờ tiếp theo</th><th scope="col">Qua đêm<small>22h–11h</small></th><th scope="col">Phòng ngày<small>14h–11h</small></th></tr></thead>
            <tbody>{rows}</tbody>
          </table>
        </div>
        <ul class="pnotes">{notes}</ul>
        <div class="bp-times">
          <div class="bp-time"><b>Mọi lúc</b><span>Combo 2 giờ, 3 giờ</span></div>
          <div class="bp-time"><b>22:00</b><span>Nhận phòng qua đêm, trả 11:00</span></div>
          <div class="bp-time"><b>14:00</b><span>Nhận phòng ngày, trả 11:00 hôm sau</span></div>
        </div>
      </div>
    </div>
  </section>

  <section class="section" id="vi-tri" aria-labelledby="locT">
    <div class="wrap bp-loc-grid">
      <div class="bp-loc-card" data-reveal>
        <p class="eyebrow">Đường đến nhà</p>
        <h3 id="locT">{b['addr']}</h3>
        <p>Mở Google Maps để chỉ đường. Đến nơi gọi hotline, bọn mình ra đón.</p>
        <a class="btn magnetic" href="{b['map']}" target="_blank" rel="noopener">Mở Google Maps {ARROW}</a>
      </div>
      <ul class="bp-loc-list" data-reveal>{near}</ul>
    </div>
  </section>

{others(bi)}
</main>"""

def soon_main(bi):
    b = B[bi]
    ring = (b['name'] + ' · COMING SOON · ' + b['dist'] + ' ·').upper()
    return f"""<main class="bp bp-soon" style="{bvars(b)}">
  <section class="soon-hero">
    <div class="wrap">
      <nav class="crumbs" aria-label="Vị trí trang" data-load style="margin-bottom:28px"><a href="{HOME_URL}">Trang chủ</a><span aria-hidden="true">/</span><a href="{HOME_URL}#chi-nhanh">Chi nhánh</a><span aria-hidden="true">/</span><span aria-current="page">{b['name']}</span></nav>
      <div class="soon-grid">
        <div class="soon-visual">
          <div class="arch"><div class="ph" data-v="{b['v']}" role="img" aria-label="Phòng chi nhánh {b['name']}"></div></div>
          <div class="soon-stamp" aria-hidden="true">
            <svg viewBox="0 0 128 128"><defs><path id="soonC" d="M64 64m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0"/></defs><text font-family="Be Vietnam Pro, sans-serif" font-size="9.6" letter-spacing="2.6" fill="currentColor"><textPath href="#soonC">{ring}</textPath></text></svg>
            <i>Q</i>
          </div>
        </div>
        <div class="soon-copy">
          <p class="eyebrow" data-load>Chi nhánh {b['n']} · {b['dist']}</p>
          <h1 class="display"><span class="line"><span>{b['name']}</span></span></h1>
          <p class="soon-big" data-load><span>Coming soon</span><span class="soon-dots" aria-hidden="true"><span>.</span><span>.</span><span>.</span></span></p>
          <p class="lede" data-load>Trang của {b['name']} đang được hoàn thiện với ảnh phòng, danh sách phòng và bảng giá chi tiết. Trong lúc chờ, chi nhánh vẫn mở cửa 24/7, bạn cứ gọi hoặc nhắn để đặt phòng.</p>
          <ul class="soon-list" data-load aria-label="Sắp cập nhật"><li class="lbl">Sắp cập nhật</li><li>Ảnh từng phòng</li><li>Danh sách phòng</li><li>Bảng giá chi tiết</li></ul>
          {contact_bits(b)}
        </div>
      </div>
    </div>
  </section>

{others(bi)}
</main>"""

def page_branch(bi):
    b = B[bi]
    mainc = soon_main(bi) if b['soon'] else branch_main(bi)
    body = (f'<body data-page="branch" data-branch="{bi}">\n{P["defs"]}\n\n{P["badge"]}\n\n{header("branch", bi)}\n{mobile_menu("branch", bi)}\n'
            f'{mainc}\n\n{footer("branch")}\n{P["lightbox"]}\n\n{CT.widget(B)}\n\n{P["toast"]}\n\n{SCRIPTS}</body>\n</html>\n')
    title = f'Qhome {b["name"]} · Staycation {b["dist"]}'
    desc = f'Q Home {b["name"]}, {b["addr"]}. Hotline {b["phoneTxt"]}. Mở cửa 24/7.' + (f' {len(b["rooms"])} phòng, bảng giá và ảnh từng phòng.' if not b['soon'] else ' Trang đang được hoàn thiện.')
    cov = (b['cover'] or {}).get('src') or ''
    return head(title, desc, b['slug'], bi, image=abs_url(cov) if re.search(r'\.(jpe?g|png)$', cov, re.I) else None) + body

# ---------------- rooms page ----------------
OPEN_LABEL = 'Mở cửa bước vào'
def rooms_main():
    total = sum(len(b['rooms']) for b in B)
    slides = []
    for i, b in enumerate(B):
        tiers = [t for t in TIERS if any(r['tier'] == t for r in b['rooms'])]
        cnt = f'{len(b["rooms"])} phòng · {", ".join(tiers)}' if not b['soon'] else 'Đang hoàn thiện'
        btn = (f'<a class="rc-open" href="{b["slug"]}.html">Ghé xem trước {ARROW}</a>' if b['soon'] else
               f'<button class="rc-open" type="button" data-open="{i}" aria-haspopup="dialog">{OPEN_LABEL} {ARROW}</button>')
        soon = '<span class="rc-soon">Sắp mở cửa</span>' if b['soon'] else ''
        slides.append(f"""<article class="rc-slide" style="{bvars(b)}" role="group" aria-roledescription="slide" aria-label="{i+1} / {len(B)}: {esc(b['name'])}">
          <div class="rc-media"><div class="ph" data-v="{b['v']}" role="img" aria-label="Phòng tại chi nhánh {esc(b['name'])}"></div></div>
          {soon}
          <div class="rc-info">
            <span class="rc-n">{b['n']}</span>
            <p class="rc-dist">{esc(b['dist'])}</p>
            <h2 class="rc-name">{esc(b['name'])}</h2>
            <p class="rc-tag">{esc(b['tagline'])}</p>
            <p class="rc-count">{cnt}</p>
          </div>
          {btn}
        </article>""")
    dots = ''.join(f'<button class="rc-dot" type="button" style="--brc:{b["c"]}" aria-label="{esc(b["name"])}"><i></i><span>{esc(b["name"])}</span></button>' for b in B)
    return f"""<main class="rp">
  <section class="rp-hero">
    <div class="wrap rp-hero-in">
      <nav class="crumbs" aria-label="Vị trí trang" data-load><a href="{HOME_URL}">Trang chủ</a><span aria-hidden="true">/</span><span aria-current="page">Phòng</span></nav>
      <p class="eyebrow" data-load>Phòng · {len(B)} ngôi nhà</p>
      <div class="rp-hero-row">
      <h1 class="display"><span class="line"><span>Mỗi cánh cửa,</span></span><span class="line"><span><span class="ital">một căn phòng.</span></span></span></h1>
      <p class="lede" data-load>Năm ngôi nhà, hơn {total // 10 * 10} căn phòng, mỗi căn một bảng màu riêng. Lướt qua từng chi nhánh, chọn một cánh cửa rồi bước vào xem.</p>
      </div>
    </div>
  </section>

  <section class="rc" aria-roledescription="carousel" aria-label="{len(B)} chi nhánh Qhome">
    <div class="rc-track" id="rcTrack" tabindex="0" aria-label="Kéo hoặc dùng phím mũi tên để xem chi nhánh khác">
        {''.join(slides)}
    </div>
    <div class="wrap rc-ctrl">
      <p class="rc-now" aria-live="polite"><b id="rcNo">01</b><span>/ {len(B):02d}</span><em id="rcName">{esc(B[0]['name'])}</em></p>
      <div class="rc-dots" role="group" aria-label="Chọn chi nhánh">{dots}</div>
      <div class="rc-arrows"><button class="rc-arrow" id="rcPrev" type="button" aria-label="Chi nhánh trước"><svg><use href="#arrow"/></svg></button><button class="rc-arrow" id="rcNext" type="button" aria-label="Chi nhánh sau"><svg><use href="#arrow"/></svg></button></div>
    </div>
  </section>

  <section class="section rp-outro">
    <div class="wrap rp-outro-in" data-reveal>
      <p class="display">Ưng căn nào, <em>nhắn chi nhánh đó nhé.</em></p>
      <p class="lede">Giá và phòng trống thay đổi theo giờ, nên mỗi chi nhánh sẽ báo bạn chính xác nhất qua Messenger, Zalo hoặc điện thoại.</p>
      <a class="btn btn-solid magnetic" href="{HOME_URL}#lien-he">Liên hệ đặt phòng {ARROW}</a>
    </div>
  </section>
</main>

<div class="rsheet" id="rSheet" role="dialog" aria-modal="true" aria-labelledby="rsName" hidden>
  <div class="rsheet-bg" data-close></div>
  <div class="rsheet-panel" data-lenis-prevent>
    <div class="rs-head">
      <div class="rs-title">
        <p class="eyebrow" id="rsNo"></p>
        <h2 class="display" id="rsName"></h2>
        <p class="rs-tag" id="rsTag"></p>
      </div>
      <button class="rs-close" id="rsClose" type="button" aria-label="Đóng danh sách phòng" data-close><svg><use href="#i-close"/></svg></button>
    </div>
    <ul class="pfeat rs-feat" id="rsFeat" aria-label="Tiện ích"></ul>
    <p class="rs-hint">Bấm vào phòng để xem ảnh, dùng mũi tên để xem phòng kế tiếp.</p>
    <div class="rs-rooms" id="rsRooms"></div>
    <div class="rs-foot"><a class="btn btn-line" id="rsPage" href="#">Xem trang chi nhánh {ARROW}</a><a class="btn btn-solid" id="rsZalo" href="#" target="_blank" rel="noopener">Nhắn Zalo chi nhánh</a></div>
  </div>
</div>"""

def page_rooms():
    body = (f'<body data-page="rooms">\n{P["defs"]}\n\n{P["badge"]}\n\n{header("rooms")}\n{mobile_menu("rooms")}\n'
            f'{rooms_main()}\n\n{footer("rooms")}\n{P["lightbox"]}\n\n{CT.widget(B)}\n\n{P["toast"]}\n\n{SCRIPTS}</body>\n</html>\n')
    return head('Phòng · Qhome Staycation', 'Xem ảnh phòng tại các chi nhánh Q Home: ' + ', '.join(b['name'] for b in B) + '. Mỗi phòng một bảng màu riêng.', 'rooms', None) + body


# ---------------- FAQ (theo nội quy lưu trú) ----------------
FAQ = [
  ('nhan-tra-phong', 'Nhận & trả phòng', [
    ('Giờ nhận phòng và trả phòng là khi nào?',
     '<p>Thời gian lưu trú được tính theo đúng khung giờ bạn đã đặt. Ví dụ bạn đặt từ 12:00 đến 15:00 thì nhận phòng lúc 12:00 và trả phòng lúc 15:00.</p>'),
    ('Mình muốn nhận phòng sớm hoặc trả phòng muộn hơn được không?',
     '<p>Được, nếu phòng còn trống. Bạn nhắn chi nhánh trước để bọn mình sắp xếp. Phần thời gian thêm sẽ tính phụ thu theo giá niêm yết.</p>'),
    ('Trả phòng sớm hơn giờ đã đặt thì có được giảm giá hay hoàn tiền không?',
     '<p>Không. Khi bạn trả phòng sớm hơn khung giờ đã đặt, Qhome không điều chỉnh giá phòng và không hoàn tiền phần thời gian còn lại.</p>'),
    ('Nếu mình đến muộn hơn giờ nhận phòng thì sao?',
     '<p>Bạn nhắn hoặc gọi báo chi nhánh trước là được, bọn mình vẫn giữ phòng cho bạn. Trường hợp đã quá giờ nhận phòng mà không có thông báo và không liên lạc được, Qhome có quyền huỷ đặt phòng, không hoàn cọc và nhường phòng cho lượt đặt khác.</p>'),
    ('Khi nhận phòng cần mang theo giấy tờ gì?',
     '<p>Bạn làm thủ tục tại quầy lễ tân và xuất trình một giấy tờ tuỳ thân: CMND, CCCD hoặc hộ chiếu.</p>'),
    ('Khi trả phòng có kiểm tra phòng không?',
     '<p>Có. Sau khi bạn trả phòng, nhân viên sẽ kiểm tra tình trạng phòng. Nếu có hư hỏng hoặc mất mát tài sản, Qhome sẽ báo bạn và tính phí bồi thường vào hoá đơn cuối cùng.</p>'),
  ]),
  ('so-khach-phu-thu', 'Số khách & phụ thu', [
    ('Một phòng ở được mấy người?',
     '<p>Mỗi phòng tiêu chuẩn cho 2 khách. Nếu đi đông hơn, bạn báo lễ tân trước, phụ thu <b>100.000đ cho mỗi người thêm</b>.</p>'),
    ('Bạn bè ghé chơi có tính phí không?',
     '<p>Bạn bè hoặc người thân ghé thăm từ 2 tiếng trở lên sẽ phụ thu <b>100.000đ</b>. Ghé dưới 2 tiếng thì không tính phí.</p>'),
    ('Trẻ em có tính phí không?',
     '<p>Trẻ em dưới 6 tuổi được miễn phí khi ở chung phòng với người lớn.</p>'),
    ('Qhome có giường phụ không?',
     '<p>Có. Bạn báo trước khi đến để bọn mình chuẩn bị. Phụ thu <b>100.000đ cho mỗi giường phụ</b>.</p>'),
  ]),
  ('noi-quy', 'Nội quy trong phòng', [
    ('Có được hút thuốc trong phòng không?',
     '<p>Không. Qhome không cho phép hút thuốc, sử dụng chất kích thích hoặc các chất cấm trong phòng.</p>'),
    ('Mình muốn tổ chức sinh nhật hoặc tiệc nhỏ trong phòng được không?',
     '<p>Bạn cần nhắn chi nhánh để được Qhome chấp thuận trước. Phòng không dùng để tổ chức tiệc tùng hoặc sự kiện khi chưa được đồng ý.</p>'),
    ('Có giờ yên tĩnh không?',
     '<p>Có. Từ 22:00 đến 08:00, bạn giữ yên lặng giúp bọn mình để mọi phòng đều được nghỉ ngơi trọn vẹn.</p>'),
    ('Mang thú cưng theo được không?',
     '<p>Rất tiếc là không. Qhome hiện chưa nhận thú cưng.</p>'),
    ('Có được mang đồ ăn, thức uống từ bên ngoài vào không?',
     '<p>Được. Bạn cứ mang theo món mình thích, chỉ cần giữ phòng sạch sẽ giúp bọn mình.</p>'),
    ('Mình cần lưu ý gì để giữ phòng?',
     '<p>Bạn giữ vệ sinh chung, bảo quản đồ đạc trong phòng và tránh làm hư hỏng hoặc thất lạc. Mọi hư hỏng, mất mát sẽ được tính phí bồi thường khi trả phòng.</p>'),
  ]),
  ('huy-phong', 'Huỷ & dời lịch', [
    ('Huỷ phòng có mất phí không?',
     '<p>Tuỳ thời điểm bạn báo huỷ so với giờ nhận phòng:</p><ul><li><b>Từ 72 tiếng trở lên:</b> huỷ miễn phí, và được hỗ trợ dời lịch trong vòng 2 tuần tính từ ngày huỷ.</li><li><b>Trong vòng 48 tiếng:</b> không hoàn cọc, chỉ hỗ trợ dời lịch trong vòng 2 tuần tính từ thời điểm đặt phòng.</li><li><b>Trong vòng 12 tiếng:</b> không hoàn cọc và không dời lịch.</li></ul>'),
    ('Mình muốn dời lịch thay vì huỷ thì sao?',
     '<p>Bạn nhắn chi nhánh càng sớm càng tốt. Nếu báo trước giờ nhận phòng hơn 12 tiếng, bạn được dời lịch trong vòng 2 tuần. Trong vòng 12 tiếng trước giờ nhận phòng thì Qhome không hỗ trợ dời lịch.</p>'),
  ]),
]
FEES = [('Thêm người', '100.000đ', 'mỗi người, quá 2 khách'), ('Khách ghé thăm', '100.000đ', 'từ 2 tiếng trở lên'), ('Giường phụ', '100.000đ', 'mỗi giường'), ('Trẻ dưới 6 tuổi', 'Miễn phí', 'ở chung với người lớn')]
CANCEL = [('Từ 72 tiếng trở lên', 'trước giờ nhận phòng', 'Huỷ miễn phí', 'Dời lịch trong 2 tuần kể từ ngày huỷ', 'ok'),
          ('Trong vòng 48 tiếng', 'trước giờ nhận phòng', 'Không hoàn cọc', 'Dời lịch trong 2 tuần kể từ lúc đặt', 'mid'),
          ('Trong vòng 12 tiếng', 'trước giờ nhận phòng', 'Không hoàn cọc', 'Không dời lịch', 'no')]

def faq_main():
    nav = ''.join(f'<li><a href="#{cid}" data-faq-nav><span class="n">{i+1:02d}</span>{esc(name)}<small>{len(items)}</small></a></li>' for i, (cid, name, items) in enumerate(FAQ))
    fees = ''.join(f'<li><span>{a}</span><b>{b}</b><small>{c}</small></li>' for a, b, c in FEES)
    cats = []
    for i, (cid, name, items) in enumerate(FAQ):
        extra = ''
        if cid == 'huy-phong':
            extra = '<ol class="fq-timeline" aria-label="Chính sách huỷ phòng">' + ''.join(
                f'<li class="t-{k}"><span class="when"><b>{w}</b><small>{w2}</small></span><span class="what"><b>{a}</b><small>{b}</small></span></li>' for w, w2, a, b, k in CANCEL) + '</ol>'
        qs = ''.join(f'<details class="fq-item"><summary><span class="q">{esc(q)}</span><i class="pm" aria-hidden="true"></i></summary><div class="fq-a">{a}</div></details>' for q, a in items)
        cats.append(f'<section class="fq-cat" id="{cid}" aria-labelledby="{cid}-t"><header class="fq-cat-h"><span class="n">{i+1:02d}</span><h2 id="{cid}-t">{esc(name)}</h2></header>{extra}<div class="fq-items">{qs}</div></section>')
    return f"""<main class="fq">
  <section class="fq-hero">
    <div class="wrap fq-hero-in">
      <nav class="crumbs" aria-label="Vị trí trang" data-load><a href="{HOME_URL}">Trang chủ</a><span aria-hidden="true">/</span><span aria-current="page">Hỏi đáp</span></nav>
      <p class="eyebrow" data-load>Hỏi đáp · Nội quy lưu trú</p>
      <h1 class="display"><span class="line"><span>Hỏi gì,</span></span><span class="line"><span><span class="ital">Qhome cũng trả lời.</span></span></span></h1>
      <p class="lede" data-load>Những điều bạn hay thắc mắc trước khi về nhà: giờ nhận phòng, phụ thu, nội quy và chính sách huỷ. Tất cả gói gọn từ nội quy lưu trú của Qhome.</p>
      <label class="fq-search" data-load><svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M16 16l4.5 4.5" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg><input type="search" id="fqSearch" placeholder="Tìm nhanh, ví dụ: thú cưng, huỷ phòng, giường phụ…" aria-label="Tìm câu hỏi"></label>
    </div>
  </section>

  <section class="fq-body">
    <div class="wrap fq-grid">
      <aside class="fq-side">
        <nav class="fq-nav" aria-label="Nhóm câu hỏi"><ul>{nav}</ul></nav>
        <div class="fq-fees" data-reveal><p class="eyebrow">Phụ thu nhanh</p><ul>{fees}</ul></div>
      </aside>
      <div class="fq-list">
        {''.join(cats)}
        <p class="fq-empty" id="fqEmpty" hidden>Chưa có câu hỏi nào khớp. Bạn thử từ khoá khác, hoặc nhắn thẳng chi nhánh để được trả lời ngay.</p>
      </div>
    </div>
  </section>

  <section class="section fq-outro">
    <div class="wrap fq-outro-in" data-reveal>
      <p class="display">Chưa thấy câu bạn cần? <em>Nhắn bọn mình nhé.</em></p>
      <p class="lede">Mỗi chi nhánh trực Messenger, Zalo và điện thoại 24/7. Nội dung trên theo nội quy lưu trú hiện hành, chi nhánh sẽ xác nhận lại khi bạn đặt phòng.</p>
      <a class="btn btn-solid magnetic" href="{HOME_URL}#lien-he">Liên hệ chi nhánh {ARROW}</a>
    </div>
  </section>
</main>"""

def faq_ld():
    import re as _re
    ents = [{'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': _re.sub(r'<[^>]+>', ' ', a).replace('  ', ' ').strip()}} for _, _, items in FAQ for q, a in items]
    return '<script type="application/ld+json">' + json.dumps({'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': ents}, ensure_ascii=False).replace('</', '<\\/') + '</script>\n'

def page_faq():
    body = (f'<body data-page="faq">\n{P["defs"]}\n\n{P["badge"]}\n\n{header("faq")}\n{mobile_menu("faq")}\n'
            f'{faq_main()}\n\n{footer("faq")}\n\n{CT.widget(B)}\n\n{P["toast"]}\n\n{faq_ld()}{SCRIPTS}</body>\n</html>\n')
    return head('Hỏi đáp & nội quy · Qhome Staycation', 'Giờ nhận phòng, phụ thu, nội quy và chính sách huỷ phòng tại Q Home Staycation. Câu trả lời nhanh cho những thắc mắc thường gặp.', 'faq', -1) + body

# ---------------- write ----------------
os.makedirs(f'{ROOT}/site/assets/img', exist_ok=True)
css = open(f'{ROOT}/src/base.css', encoding='utf-8').read() + open(f'{ROOT}/src/story.css', encoding='utf-8').read() + open(f'{ROOT}/src/rooms.css', encoding='utf-8').read() + open(f'{ROOT}/src/branch.css', encoding='utf-8').read() + open(f'{ROOT}/src/roomspage.css', encoding='utf-8').read() + open(f'{ROOT}/src/faq.css', encoding='utf-8').read() + open(f'{ROOT}/src/admin_bridge.css', encoding='utf-8').read()
open(f'{ROOT}/site/assets/style.css', 'w', encoding='utf-8').write(css)
js = open(f'{ROOT}/src/main.js', encoding='utf-8').read().replace('/*__BRANCHES__*/[]', json.dumps(CT.js_data(B), ensure_ascii=False))
open(f'{ROOT}/site/assets/main.js', 'w', encoding='utf-8').write(js)
home = page_home(); story = page_story(); rooms = page_rooms(); faq = page_faq()
open(f'{ROOT}/site/index.html', 'w', encoding='utf-8').write(home)
open(f'{ROOT}/site/cau-chuyen.html', 'w', encoding='utf-8').write(story)
open(f'{ROOT}/site/phong.html', 'w', encoding='utf-8').write(rooms)
open(f'{ROOT}/site/faq.html', 'w', encoding='utf-8').write(faq)
branch_pages = [(b['slug'] + '.html', page_branch(i), None) for i, b in enumerate(B)]
# nội dung hiệu lực cho trang quản trị + danh sách trang
os.makedirs(f'{ROOT}/site/admin', exist_ok=True)
json.dump(C, open(f'{ROOT}/site/admin/content.json', 'w', encoding='utf-8'), ensure_ascii=False)
json.dump([{'key': 'home', 'file': 'index.html', 'name': 'Trang chủ'}, {'key': 'story', 'file': 'cau-chuyen.html', 'name': 'Câu chuyện'}, {'key': 'rooms', 'file': 'phong.html', 'name': 'Phòng'}, {'key': 'faq', 'file': 'faq.html', 'name': 'Hỏi đáp'}] +
          [{'key': b['slug'], 'file': b['slug'] + '.html', 'name': b['name'], 'branch': i} for i, b in enumerate(B)],
          open(f'{ROOT}/site/admin/pages.json', 'w', encoding='utf-8'), ensure_ascii=False)
# sơ đồ web cho Google
import datetime as _dt
_today = _dt.date.today().isoformat()
_urls = ['/', '/phong', '/cau-chuyen', '/faq'] + ['/' + b['slug'] for b in B]
open(f'{ROOT}/site/sitemap.xml', 'w', encoding='utf-8').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + ''.join(f'  <url><loc>{SITE_URL}{u}</loc><lastmod>{_today}</lastmod></url>\n' for u in _urls) + '</urlset>\n')
open(f'{ROOT}/site/robots.txt', 'w', encoding='utf-8').write(f'User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: {SITE_URL}/sitemap.xml\n')
# chuyển hướng link trang chi nhánh cũ khi đổi tên chi nhánh (vd ba-thang-hai.html -> 3-2.html)
_cur = [b['slug'] for b in B]
_redir = []
for x in json.load(open(f'{ROOT}/src/branches.json', encoding='utf-8')):
    o = CT.slugify(x['name'])
    if o in _cur: continue
    # tìm chi nhánh hiện tại cùng số điện thoại (định danh không đổi khi đổi tên)
    hit = next((b for b in B if b['phone'] == re.sub(r'\D', '', x['phone'])), None)
    if hit: _redir.append(f'/{o}.html  /{hit["slug"]}.html  301')
open(f'{ROOT}/site/_redirects', 'w', encoding='utf-8').write('\n'.join(_redir) + ('\n' if _redir else ''))
# xoá trang chi nhánh cũ không còn dùng
keep = {'index.html', 'cau-chuyen.html', 'phong.html', 'faq.html'} | {n for n, _, _ in branch_pages}
for f in os.listdir(f'{ROOT}/site'):
    if f.endswith('.html') and f not in keep: os.remove(f'{ROOT}/site/{f}')
for name, html, _ in branch_pages: open(f'{ROOT}/site/{name}', 'w', encoding='utf-8').write(html)

# preview for Artifact: strip document wrapper from home
IS_NETLIFY = bool(os.environ.get('NETLIFY'))
pv = home
pv = pv.replace('<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n', '')
pv = pv.replace('</head>\n<body data-page="home">', '<div hidden></div>').replace('</body>\n</html>\n', '')
pv = pv.replace('<div hidden></div>', '<script>document.body.dataset.page="home"</script>')
pv = pv.replace('<title>Qhome Staycation</title>\n', '<title>Qhome Staycation</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n', 1)
if not IS_NETLIFY: open(f'{ROOT}/index.html', 'w', encoding='utf-8').write(pv)
print('built', len(home), len(story), len(css), len(js))

# ---------------- standalone (mỗi trang 1 file, tự chứa CSS/JS/ảnh) ----------------
import base64
def inline(html, keep):
    css_inl = css
    def sub(mo):
        f = mo.group(1)
        return 'url("data:image/webp;base64,' + base64.b64encode(open(f'{ROOT}/site/assets/img/{f}', 'rb').read()).decode() + '")'
    css_inl = re.sub(r'url\("img/([\w/]+\.webp)"\)', sub, css_inl)
    html = re.sub(r'url\("assets/img/([\w/]+\.webp)"\)', sub, html)
    html = html.replace('<link rel="stylesheet" href="assets/style.css">', '<style>\n' + css_inl + '\n</style>')
    html = html.replace('<script src="assets/main.js"></script>', '<script>\n' + js.replace('</script', '<\\/script') + '\n</script>')
    assert 'assets/style.css' not in html and 'assets/main.js' not in html
    return html
os.makedirs(f'{ROOT}/export', exist_ok=True)
for name, html, keep in ([] if IS_NETLIFY else [('index.html', home, None), ('cau-chuyen.html', story, None), ('phong.html', rooms, None), ('faq.html', faq, None)] + branch_pages):
    open(f'{ROOT}/export/{name}', 'w', encoding='utf-8').write(inline(html, keep))
print('standalone ok')
