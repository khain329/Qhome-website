/* Qhome – script dùng chung cho mọi trang.
   Trang hiện tại xác định bằng <body data-page="home|story">. */
(function(){
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const page = document.body.dataset.page || 'home';
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = !!(window.gsap && window.ScrollTrigger);
  const HEADER_OFFSET = -84;
  const yr = $('#yr'); if (yr) yr.textContent = new Date().getFullYear();

  /* ===================== NỘI DUNG TỪ TRANG QUẢN TRỊ ===================== */
  if (/(invite|recovery|confirmation|email_change)_token=/.test(location.hash)) { location.replace('/admin/' + location.hash); return; }
  const ADMIN = /[?&]admin\b/.test(location.search) && window.parent !== window;
  const TXT_SEL = 'h1,h2,h3,h4,p,li,td,th,b,small,time,label,.eyebrow,.btn,a.go,.room-no';
  const TXT_SKIP = '#brPanel, #brRooms, .marquee, svg, .br-rooms-head, #lb, .cw, .mobile-menu, header.site, .curtain, .toast, .mock-badge, .soon-dots, .crumbs';
  const hashStr = s => { let h = 5381; s = String(s).replace(/\s+/g, ' ').trim(); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
  const SLOTS = { img: {}, txt: {} };
  (function tagSlots(){
    let n = 0, t = 0;
    $$('main .ph').forEach(el => {
      if (el.id === 'brPh' || el.closest('#brRooms, #lb') || /^(cv|rp|rt)-/.test(el.dataset.v || '')) return;
      const k = 'i' + (n++); el.dataset.ek = k;
      SLOTS.img[k] = { el, h: hashStr((el.dataset.v || '') + '|' + (el.getAttribute('aria-label') || (el.closest('[data-cap]') || {}).dataset?.cap || '') + '|' + k) };
    });
    const sel = TXT_SEL.split(',').map(x => 'main ' + x + ', footer ' + x).join(', ');
    $$(sel).forEach(el => {
      if (el.closest(TXT_SKIP) || el.querySelector(TXT_SEL) || !el.textContent.trim()) return;
      const k = 't' + (t++); el.dataset.tk = k;
      SLOTS.txt[k] = { el, h: hashStr(el.innerHTML), def: el.innerHTML };
    });
  })();
  function imgStyle(el, e){
    if (!el) return;
    ['--img', '--pos', 'scale', 'transform-origin'].forEach(p => el.style.removeProperty(p));
    if (!e) return;
    const x = e.x != null ? e.x : 50, y = e.y != null ? e.y : 50, z = +e.z || 1;
    if (e.src) el.style.setProperty('--img', 'url("' + e.src + '")');
    el.style.setProperty('--pos', x + '% ' + y + '%');
    if (Math.abs(z - 1) > .001) { el.style.setProperty('scale', String(z)); el.style.setProperty('transform-origin', x + '% ' + y + '%'); }
  }
  function findSlot(kind, key, h){
    const s = SLOTS[kind][key]; if (s && (!h || s.h === h)) return s;
    if (!h) return null;
    return Object.values(SLOTS[kind]).find(v => v.h === h) || null;
  }
  function applyEntry(kind, key, e){
    const s = findSlot(kind, key, e && e.h); if (!s) return;
    if (kind === 'img') imgStyle(s.el, e && (e.src || e.x != null) ? e : null);
    else s.el.innerHTML = e && e.v != null ? e.v : s.def;
  }
  let CONTENT = {}; try { CONTENT = JSON.parse(($('#qh-content') || {}).textContent || '{}') || {}; } catch (e) { CONTENT = {}; }
  ['img', 'txt'].forEach(kind => Object.keys(CONTENT[kind] || {}).forEach(k => applyEntry(kind, k, CONTENT[kind][k])));

  const BR = /*__BRANCHES__*/[];

  /* ---------- toast & sao chép số ---------- */
  const toast = $('#toast'); let tt;
  function say(msg){ if (!toast) return; toast.textContent = msg; toast.classList.add('show'); clearTimeout(tt); tt = setTimeout(() => toast.classList.remove('show'), 2200); }
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-copy]'); if (!btn) return;
    const num = btn.dataset.copy, nice = num.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
    const fallback = () => say('Số: ' + nice);
    try { navigator.clipboard.writeText(num).then(() => say('Đã sao chép ' + nice), fallback); } catch (err) { fallback(); }
  });

  /* ---------- cuộn mượt ---------- */
  let lenis = null;
  if (!reduce && window.Lenis) {
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    if (hasGsap) { lenis.on('scroll', ScrollTrigger.update); gsap.ticker.add(t => lenis.raf(t * 1000)); gsap.ticker.lagSmoothing(0); }
    else { const raf = t => { lenis.raf(t); requestAnimationFrame(raf); }; requestAnimationFrame(raf); }
  }
  function goTo(hash, immediate){
    const top = hash === '#top'; const el = top ? document.body : $(hash); if (!el) return;
    if (lenis) lenis.scrollTo(top ? 0 : el, { offset: HEADER_OFFSET, immediate: !!immediate });
    else if (top) scrollTo({ top: 0, behavior: reduce || immediate ? 'auto' : 'smooth' });
    else { const y = el.getBoundingClientRect().top + scrollY + HEADER_OFFSET; scrollTo({ top: y, behavior: reduce || immediate ? 'auto' : 'smooth' }); }
  }

  /* ---------- header: luôn hiện, đổi nền khi cuộn ---------- */
  const header = $('header.site');
  const onScroll = y => header && header.classList.toggle('scrolled', y > 20);
  if (lenis) lenis.on('scroll', e => onScroll(e.scroll)); else addEventListener('scroll', () => onScroll(scrollY), { passive: true });
  onScroll(scrollY);

  /* ---------- menu điện thoại ---------- */
  const burger = $('#burger'), menu = $('#mobile-menu');
  function setMenu(open){
    if (!burger || !menu) return;
    root.classList.toggle('menu-open', open);
    burger.setAttribute('aria-expanded', open); burger.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    menu.setAttribute('aria-hidden', !open);
    if (lenis) open ? lenis.stop() : lenis.start();
    if (open && hasGsap && !reduce) gsap.from('#mobile-menu nav > a, #mobile-menu nav > button', { yPercent: 60, opacity: 0, stagger: .06, duration: .7, delay: .25, ease: 'power3.out' });
  }
  if (burger) burger.addEventListener('click', () => setMenu(!root.classList.contains('menu-open')));
  const mmAcc = $('#mmAcc'), mmSub = $('#mmSub');
  if (mmAcc && mmSub) mmAcc.addEventListener('click', () => {
    const open = mmAcc.getAttribute('aria-expanded') !== 'true'; mmAcc.setAttribute('aria-expanded', open); mmSub.hidden = !open;
    if (open && hasGsap && !reduce) gsap.from('#mmSub a', { x: -14, opacity: 0, stagger: .05, duration: .45, ease: 'power3.out' });
  });

  /* ---------- dropdown chi nhánh ---------- */
  const dd = $('#dd'), ddToggle = $('#ddToggle'); let ddTimer;
  function openDd(){ if (!dd) return; clearTimeout(ddTimer); dd.classList.add('open'); ddToggle.setAttribute('aria-expanded', 'true'); }
  function closeDd(){ if (!dd) return; clearTimeout(ddTimer); dd.classList.remove('open'); ddToggle.setAttribute('aria-expanded', 'false'); }
  if (dd && ddToggle) {
    ddToggle.addEventListener('click', () => dd.classList.contains('open') ? closeDd() : openDd());
    if (finePointer) { dd.addEventListener('mouseenter', openDd); dd.addEventListener('mouseleave', () => { ddTimer = setTimeout(closeDd, 220); }); }
    document.addEventListener('click', e => { if (!dd.contains(e.target)) closeDd(); });
    dd.addEventListener('focusout', e => { if (!dd.contains(e.relatedTarget)) closeDd(); });
    ddToggle.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); openDd(); const f = $('.dd-item', dd); if (f) f.focus(); } });
    $$('.dd-item').forEach((it, k, all) => {
      const hot = () => { all.forEach(x => x.classList.toggle('hot', x === it)); const b = BR[k]; if (!b) return; $('#ddPrev').style.setProperty('--brc', b.c); $('#ddPh').dataset.v = b.v; $('#ddCap').textContent = b.name; };
      it.addEventListener('mouseenter', hot); it.addEventListener('focus', hot);
      it.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); (all[k + 1] || all[0]).focus(); } if (e.key === 'ArrowUp') { e.preventDefault(); (all[k - 1] || all[all.length - 1]).focus(); } });
    });
  }

  /* ---------- widget gọi / nhắn tin ---------- */
  const cwBtns = { call: $('#cwCallBtn'), chat: $('#cwChatBtn') }, cwPanels = { call: $('#cwCall'), chat: $('#cwChat') };
  let cwOpen = null;
  function cwSet(which){
    if (!cwBtns.call) return;
    cwOpen = which;
    Object.keys(cwBtns).forEach(k => { const on = k === which; cwBtns[k].setAttribute('aria-expanded', on); cwPanels[k].hidden = !on; });
    if (which && finePointer) setTimeout(() => { const f = cwPanels[which].querySelector('.cw-row, .cw-mess'); if (f) f.focus({ preventScroll: true }); }, 60);
  }
  if (cwBtns.call) {
    Object.keys(cwBtns).forEach(k => cwBtns[k].addEventListener('click', e => { e.stopPropagation(); cwSet(cwOpen === k ? null : k); }));
    $$('[data-cw-close]').forEach(b => b.addEventListener('click', () => { const k = cwOpen; cwSet(null); if (k) cwBtns[k].focus(); }));
    document.addEventListener('click', e => { if (cwOpen && !e.target.closest('#cw')) cwSet(null); });
    $$('[data-open-cw]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); cwSet(b.dataset.openCw); }));
  }

  /* ---------- chi nhánh (trang chủ) ---------- */
  const money = k => String(k * 1000).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const brTabs = $$('.br-tab'), brSec = $('#chi-nhanh'); let brCur = 0;
  function selectBranch(i, animate){
    if (!brSec || !brTabs.length) return;
    i = (i + BR.length) % BR.length; const b = BR[i]; const changed = i !== brCur; brCur = i;
    brTabs.forEach((t, k) => { const on = k === i; t.setAttribute('aria-selected', on); t.tabIndex = on ? 0 : -1; });
    $('#brPanel').setAttribute('aria-labelledby', 'brTab' + i);
    brSec.style.setProperty('--brc', b.c); brSec.style.setProperty('--bron', b.ink); brSec.style.setProperty('--brt', b.t);
    $('#brNo').textContent = 'Chi nhánh ' + b.n + ' · ' + b.dist; $('#brName').textContent = b.name; $('#brAddr').textContent = b.addr;
    $('#brPhone').textContent = b.phoneTxt; $('#brCopy').dataset.copy = b.phone; $('#brCall').href = 'tel:' + b.phone; $('#brMap').href = b.map; const bp = $('#brPage'); if (bp) { bp.href = b.slug + '.html'; bp.textContent = !b.soon ? 'Xem trang chi nhánh' : 'Trang chi nhánh (sắp ra mắt)'; }
    $('#brPh').dataset.v = b.v; $('#brPhLabel').hidden = true; $('#brPhCap').textContent = 'Ảnh thật: chi nhánh ' + b.name;
    $('#brCapName').textContent = b.name;
    $('#brRows').innerHTML = b.rows.map(r => '<tr><th scope="row">' + r[0] + '</th>' + r[1].map(x => '<td>' + money(x) + '</td>').join('') + '</tr>').join('');
    $('#brNotes').innerHTML = b.notes.map(x => '<li>' + x + '</li>').join('');
    renderRooms(b, animate && changed);
    const list = brTabs[i].parentElement;
    if (list.scrollWidth > list.clientWidth) list.scrollTo({ left: brTabs[i].offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
    if (animate && changed && hasGsap && !reduce) {
      gsap.fromTo('#brMedia', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 18px 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 18px 18px)', duration: .9, ease: 'power3.inOut' });
      gsap.fromTo('#brInfo > *', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: .6, stagger: .05, ease: 'power3.out', delay: .15 });
      gsap.fromTo('#brRows tr', { x: -12, opacity: 0 }, { x: 0, opacity: 1, duration: .5, stagger: .05, ease: 'power3.out', delay: .25 });
    }
  }
  const TIERS = ['Standard', 'Deluxe', 'Premium', 'Suite'];
  function renderRooms(b, animate){
    const feat = $('#brFeat');
    if (feat) { feat.innerHTML = (b.feat || []).map(x => '<li>' + x + '</li>').join(''); const none = !(b.feat || []).length; feat.hidden = none; if (feat.parentElement.classList.contains('br-feat')) feat.parentElement.hidden = none; }
    const wrap = $('#brRooms'); if (!wrap) return;
    const rooms = b.rooms || [];
    if ($('#brRoomCount')) $('#brRoomCount').textContent = rooms.length ? rooms.length + ' phòng' : '';
    if (!rooms.length) { wrap.innerHTML = '<p class="br-empty">Ảnh và danh sách phòng của chi nhánh này đang được cập nhật. Gọi hotline để hỏi phòng trống.</p>'; return; }
    wrap.innerHTML = TIERS.filter(t => rooms.some(r => r.tier === t)).map(t =>
      '<div class="rgroup"><p class="rgroup-t">' + t + '</p><div class="rgrid">' +
      rooms.map((r, i) => r.tier !== t ? '' :
        '<button class="rtile" type="button" data-room="' + i + '" aria-label="Xem phòng ' + r.no + ', ' + r.tier + (r.m2 ? ', ' + r.m2 + ' mét vuông' : '') + '">' +
        '<span class="ph" data-v="' + r.tv + '"></span><span class="rt-body"><b>' + r.no + '</b><small>' + (r.m2 ? r.m2 + 'm²' : r.tier) + '</small></span></button>').join('') +
      '</div></div>').join('');
    if (animate && hasGsap && !reduce) gsap.from($$('.rtile', wrap), { y: 14, opacity: 0, duration: .5, stagger: .025, ease: 'power3.out', clearProps: 'all' });
  }
  if ($('#brRooms')) $('#brRooms').addEventListener('click', e => {
    const t = e.target.closest('.rtile'); if (!t) return;
    const b = BR[brCur]; const rooms = b.rooms;
    openLb(rooms.map(r => ({ v: r.pv, cap: 'Phòng ' + r.no + ' · ' + r.tier + (r.m2 ? ' · ' + r.m2 + 'm²' : '') + ' · ' + b.name })), +t.dataset.room, t);
  });
  brTabs.forEach((t, k) => {
    t.addEventListener('click', () => selectBranch(k, true));
    t.addEventListener('keydown', e => {
      const d = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : (e.key === 'ArrowUp' || e.key === 'ArrowLeft') ? -1 : 0;
      if (!d) return; e.preventDefault(); selectBranch(k + d, true); brTabs[brCur].focus();
    });
  });
  if (brSec && BR.length) selectBranch(0, false);
  /* trang chi nhánh riêng */
  if (page === 'branch') { brCur = +(document.body.dataset.branch || 0); if ($('#brRooms')) renderRooms(BR[brCur], false); }

  /* ---------- link nội trang (#...) ---------- */
  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const h = a.getAttribute('href'); if (h.length < 2) return;
    const isBranch = a.dataset.branch !== undefined;
    const target = isBranch ? '#chi-nhanh' : h;
    if (target !== '#top' && !$(target)) return;
    e.preventDefault(); if (root.classList.contains('menu-open')) setMenu(false);
    closeDd(); cwSet(null); if (isBranch) selectBranch(+a.dataset.branch, true); goTo(target);
  }));

  /* ---------- lightbox dùng chung: gallery & poster phòng ---------- */
  const lb = $('#lb'); let lbList = [], lbIdx = 0, lbFrom = null;
  function lbShow(i){
    lbIdx = (i + lbList.length) % lbList.length; const it = lbList[lbIdx], img = $('#lbImg');
    img.dataset.v = it.v; img.setAttribute('style', it.css || ''); $('#lbCap').textContent = it.cap; $('#lbCount').textContent = (lbIdx + 1) + ' / ' + lbList.length;
    if (hasGsap && !reduce) gsap.fromTo(img, { scale: .96, opacity: 0 }, { scale: 1, opacity: 1, duration: .5, ease: 'power3.out' });
  }
  function openLb(list, i, from){ if (!lb) return; lbList = list; lbFrom = from || null; lbShow(i); lb.classList.add('open'); if (lenis) lenis.stop(); $('#lbClose').focus(); }
  function closeLb(){ lb.classList.remove('open'); if (lenis) lenis.start(); if (lbFrom) lbFrom.focus(); }
  const lbOpen = () => !!lb && lb.classList.contains('open');
  const lbKey = e => { if (e.key === 'Escape') closeLb(); if (e.key === 'ArrowRight') lbShow(lbIdx + 1); if (e.key === 'ArrowLeft') lbShow(lbIdx - 1); };
  if (lb) {
    const items = $$('.g-item');
    items.forEach((it, i) => it.addEventListener('click', () => openLb(items.map(x => ({ v: x.dataset.v, cap: x.dataset.cap, css: (x.querySelector('.ph') || x).getAttribute('style') || '' })), i, it)));
    $('#lbClose').addEventListener('click', closeLb);
    $('#lbPrev').addEventListener('click', () => lbShow(lbIdx - 1));
    $('#lbNext').addEventListener('click', () => lbShow(lbIdx + 1));
    let sx = null;
    $('#lbStage').addEventListener('touchstart', e => sx = e.touches[0].clientX, { passive: true });
    $('#lbStage').addEventListener('touchend', e => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) lbShow(lbIdx + (dx < 0 ? 1 : -1)); sx = null; });
    lb.addEventListener('click', e => { if (e.target === lb || e.target.id === 'lbStage') closeLb(); });
  }

  addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDd(); if (cwOpen) { const k = cwOpen; cwSet(null); cwBtns[k].focus(); } if (root.classList.contains('menu-open')) setMenu(false); }
    if (lbOpen()) lbKey(e);
  });

  /* ---------- hash khi mở trang (vd. ./#cn-3 hoặc ./#phong) ---------- */
  const hash = location.hash;
  const cnMatch = /^#cn-(\d)$/.exec(hash);
  function applyHash(){
    if (cnMatch) { selectBranch(+cnMatch[1] - 1, false); goTo('#chi-nhanh', true); }
    else if (hash.length > 1 && /^#[\w-]+$/.test(hash) && $(hash)) goTo(hash, true);
  }

  /* ---------- màn kéo rèm (chỉ trang chủ, một lần mỗi phiên) ---------- */
  const curtain = $('#curtain');
  let heroPlay = null, curtainDone = false;
  function afterCurtain(){ curtainDone = true; if (heroPlay) heroPlay(); }
  if (curtain) {
    let anims = [], timers = [];
    const clear = () => { anims.forEach(a => { try { a.cancel(); } catch (e) {} }); anims = []; timers.forEach(clearTimeout); timers = []; };
    const showCurtain = () => {
      clear(); curtain.classList.remove('open', 'gone', 'js'); root.classList.add('curtain-lock'); if (lenis) lenis.stop();
      setTimeout(() => $('#curtainBtn').focus({ preventScroll: true }), 50);
    };
    const openCurtain = () => {
      if (curtain.classList.contains('open')) return;
      try { sessionStorage.setItem('qh-curtain', '1'); } catch (e) {}
      const canAnim = typeof curtain.animate === 'function';
      const dur = reduce ? 950 : 1800, stagger = reduce ? 0 : 1;
      const unlockAt = reduce ? 650 : 1250, fadeAt = reduce ? 900 : 1900;
      if (canAnim) {
        curtain.classList.add('js');
        const vw = window.innerWidth / 100, ease = 'cubic-bezier(.62,0,.22,1)';
        $$('.strip', curtain).forEach(st => {
          const tx = (parseFloat(st.style.getPropertyValue('--tx')) || 0) * vw;
          const dl = (parseFloat(st.style.getPropertyValue('--dl')) || 0) * 1000 * stagger;
          anims.push(st.animate([{ transform: 'translateX(0px) scaleX(1)' }, { transform: 'translateX(' + tx.toFixed(1) + 'px) scaleX(0.84)' }], { duration: dur, delay: dl, easing: ease, fill: 'forwards' }));
        });
        anims.push($('.c-center', curtain).animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'scale(0.95) translateY(-10px)' }], { duration: 550, easing: 'ease-out', fill: 'forwards' }));
        anims.push($('.c-glow', curtain).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 900, fill: 'forwards' }));
        $$('.c-side', curtain).forEach(sd => anims.push(sd.animate([{ backgroundColor: '#E3D6C2' }, { backgroundColor: 'rgba(227,214,194,0)' }], { duration: 250, fill: 'forwards' })));
      }
      curtain.classList.add('open');
      timers.push(setTimeout(() => { root.classList.remove('curtain-lock'); if (lenis) lenis.start(); afterCurtain(); }, unlockAt));
      timers.push(setTimeout(() => {
        if (canAnim) { const a = curtain.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: 'ease-out', fill: 'forwards' }); anims.push(a); a.onfinish = () => curtain.classList.add('gone'); }
        else curtain.classList.add('gone');
      }, fadeAt));
    };
    $('#curtainBtn').addEventListener('click', openCurtain);
    curtain.addEventListener('keydown', e => { if (e.key === 'Escape') openCurtain(); if (e.key === 'Tab') { e.preventDefault(); $('#curtainBtn').focus(); } });
    const replay = $('#replayCurtain');
    if (replay) replay.addEventListener('click', () => { if (lenis) lenis.scrollTo(0, { immediate: true }); else scrollTo(0, 0); showCurtain(); });
    let seen = false; try { seen = sessionStorage.getItem('qh-curtain') === '1'; } catch (e) {}
    if (seen || hash.length > 1 || ADMIN) { curtain.classList.add('open', 'gone'); afterCurtain(); } else showCurtain();
  } else {
    /* trang phụ: đánh dấu đã vào site để về trang chủ không hiện rèm nữa */
    try { sessionStorage.setItem('qh-curtain', '1'); } catch (e) {}
    afterCurtain();
  }

  /* ===================== CẦU NỐI XEM TRƯỚC CHO TRANG QUẢN TRỊ ===================== */
  if (ADMIN) {
    root.classList.add('admin-preview');
    const post = m => window.parent.postMessage(Object.assign({ qh: 1 }, m), location.origin);
    const sectionLabel = el => {
      const sec = el.closest('section, footer, .hcard, .room, article'); if (!sec) return 'Khác';
      if (sec.tagName === 'FOOTER') return 'Chân trang';
      const top = el.closest('section, footer');
      const eb = top && top.querySelector('.eyebrow'); const h = top && top.querySelector('h1, h2');
      return ((eb && eb.textContent.trim()) || (h && h.textContent.trim()) || 'Khác').slice(0, 40);
    };
    const TAGN = { H1: 'Tiêu đề lớn', H2: 'Tiêu đề', H3: 'Tiêu đề nhỏ', H4: 'Tiêu đề nhỏ', P: 'Đoạn văn', LI: 'Dòng', TD: 'Ô bảng', TH: 'Ô tiêu đề bảng', B: 'Chữ nổi bật', SMALL: 'Chữ nhỏ', TIME: 'Giờ', LABEL: 'Nhãn' };
    const textLabel = el => el.classList.contains('btn') ? 'Nút' : el.classList.contains('eyebrow') ? 'Nhãn nhỏ' : el.matches('a.go') ? 'Liên kết' : (TAGN[el.tagName] || 'Chữ');
    const absImg = el => {
      const raw = (el.style.getPropertyValue('--img') || getComputedStyle(el).getPropertyValue('--img') || '').trim();
      const m = /url\(["']?([^"')]+)["']?\)/.exec(raw); if (!m) return '';
      let p = m[1]; if (/^img\//.test(p)) p = 'assets/' + p;
      try { return new URL(p, location.href).href; } catch (e) { return p; }
    };
    function sendSlots(){
      const list = [];
      Object.keys(SLOTS.img).forEach(k => { const s = SLOTS.img[k], el = s.el, r = el.parentElement.getBoundingClientRect();
        list.push({ kind: 'img', key: k, h: s.h, section: sectionLabel(el), label: el.getAttribute('aria-label') || (el.closest('[data-cap]') || {}).dataset?.cap || 'Ảnh', src: absImg(el), ar: r.height ? +(r.width / r.height).toFixed(3) : 1.33 }); });
      Object.keys(SLOTS.txt).forEach(k => { const s = SLOTS.txt[k];
        list.push({ kind: 'txt', key: k, h: s.h, section: sectionLabel(s.el), label: textLabel(s.el), def: s.def, cur: s.el.innerHTML }); });
      post({ type: 'slots', page: document.body.dataset.page, branch: document.body.dataset.branch, slots: list });
    }
    let flashT;
    function focusSlot(kind, key){
      const s = SLOTS[kind][key]; if (!s) return;
      $$('.qh-focus').forEach(x => x.classList.remove('qh-focus'));
      const el = kind === 'img' ? (s.el.closest('.arch, .g-item, .room-media, .hcard-media, .door-frame, .story-media') || s.el) : s.el;
      el.classList.add('qh-focus'); clearTimeout(flashT); flashT = setTimeout(() => el.classList.remove('qh-focus'), 2200);
      const y = el.getBoundingClientRect().top + scrollY - 120;
      if (lenis) lenis.scrollTo(Math.max(0, y), { immediate: true }); else scrollTo(0, Math.max(0, y));
    }
    addEventListener('message', ev => {
      const d = ev.data; if (ev.origin !== location.origin || !d || !d.qh) return;
      if (d.type === 'apply') { applyEntry(d.kind, d.key, d.entry); }
      if (d.type === 'focus') focusSlot(d.kind, d.key);
      if (d.type === 'rescan') sendSlots();
    });
    document.addEventListener('click', e => {
      const ph = e.target.closest('[data-ek]'), tx = e.target.closest('[data-tk]');
      if (ph || tx || e.target.closest('a, button')) { e.preventDefault(); e.stopPropagation(); }
      if (ph) post({ type: 'select', kind: 'img', key: ph.dataset.ek });
      else if (tx) post({ type: 'select', kind: 'txt', key: tx.dataset.tk });
    }, true);
    addEventListener('load', () => setTimeout(sendSlots, 300));
    if (document.readyState === 'complete') setTimeout(sendSlots, 300);
  }

  if (!hasGsap || reduce) { addEventListener('load', applyHash); return; }
  gsap.registerPlugin(ScrollTrigger);
  const mm = gsap.matchMedia();
  const has = sel => !!$(sel);

  /* ===================== TRANG CHỦ ===================== */
  if (page === 'home') {
    const tl = gsap.timeline({ paused: true, defaults: { ease: 'power4.out' } });
    tl.from('.hero h1 .line > span', { yPercent: 110, duration: 1.3, stagger: .12 })
      .fromTo('.hero-arch', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 18px 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 18px 18px)', duration: 1.5, ease: 'power3.inOut' }, 0)
      .from('.hero [data-load]:not(.hero-arch)', { y: 24, opacity: 0, duration: 1, stagger: .08 }, .45);
    heroPlay = () => tl.restart(); if (curtainDone) tl.play();

    if (has('.door')) mm.add({ wide: '(min-width: 760px)', narrow: '(max-width: 759px)' }, ctx => {
      const startClip = ctx.conditions.wide ? 'inset(14% 36% 6% 36% round 600px 600px 18px 18px)' : 'inset(16% 16% 10% 16% round 400px 400px 16px 16px)';
      const t = gsap.timeline({ scrollTrigger: { trigger: '.door', start: 'top top', end: '+=120%', pin: true, scrub: 1 } });
      t.fromTo('.door-frame', { clipPath: startClip }, { clipPath: 'inset(0% 0% 0% 0% round 0px 0px 0px 0px)', ease: 'none' })
       .fromTo('.door-frame .ph', { scale: 1.25 }, { scale: 1, ease: 'none' }, 0)
       .fromTo('.door-quote > div', { opacity: 0, y: 40 }, { opacity: 1, y: 0, ease: 'power2.out', duration: .45 }, .55);
    });

    if (has('.rooms-track')) mm.add('(min-width: 900px)', () => {
      const track = $('.rooms-track');
      const dist = () => Math.max(0, track.scrollWidth - window.innerWidth);
      gsap.to(track, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: '.rooms', start: 'top top', end: () => '+=' + dist(), pin: true, scrub: 1, invalidateOnRefresh: true } });
      gsap.to('.rooms-progress i', { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.rooms', start: 'top top', end: () => '+=' + dist(), scrub: true } });
    });
  }

  /* ===================== TRANG CÂU CHUYỆN ===================== */
  if (page === 'story') {
    gsap.timeline({ defaults: { ease: 'power4.out' } })
      .from('.s-hero h1 .line > span', { yPercent: 110, duration: 1.3, stagger: .1 })
      .fromTo('.s-hero-arch', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 18px 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 18px 18px)', duration: 1.5, ease: 'power3.inOut' }, 0)
      .from('.s-hero [data-load]', { y: 24, opacity: 0, duration: 1, stagger: .08 }, .4);

    /* logo tự vẽ theo cuộn */
    if (has('.s-logo')) {
      const sec = $('.s-logo'), notes = $$('.s-note'), marks = [0, .5, .76];
      sec.classList.add('js-dim');
      const setOn = p => notes.forEach((n, k) => n.classList.toggle('on', p >= marks[k] + .001));
      const build = st => {
        const t = gsap.timeline({ scrollTrigger: Object.assign({ scrub: 1, onUpdate: self => setOn(self.progress), onLeaveBack: () => setOn(-1) }, st) });
        t.fromTo('.s-arch', { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', duration: .45 }, 0)
         .fromTo('.s-roof', { strokeDashoffset: 1 }, { strokeDashoffset: 0, ease: 'none', duration: .16 }, .5)
         .fromTo('.s-fill', { opacity: 0 }, { opacity: 1, ease: 'none', duration: .14 }, .6)
         .fromTo('.s-word', { opacity: 0, y: 10 }, { opacity: 1, y: 0, ease: 'none', duration: .14 }, .76)
         .fromTo('.pin1', { opacity: 0, scale: .5 }, { opacity: 1, scale: 1, duration: .06, transformOrigin: '50% 50%' }, 0)
         .fromTo('.pin2', { opacity: 0, scale: .5 }, { opacity: 1, scale: 1, duration: .06, transformOrigin: '50% 50%' }, .5)
         .fromTo('.pin3', { opacity: 0, scale: .5 }, { opacity: 1, scale: 1, duration: .06, transformOrigin: '50% 50%' }, .76)
         .to({}, { duration: .1 });
        return t;
      };
      mm.add('(min-width: 901px)', () => { build({ trigger: '.s-logo', start: 'top top', end: '+=150%', pin: true }); });
      mm.add('(max-width: 900px)', () => { build({ trigger: '.s-mark', start: 'top 80%', end: 'bottom 40%' }); });
    }

    /* tuyên ngôn: chữ sáng dần theo cuộn */
    const mf = $('.s-manifesto-text');
    if (mf) {
      const words = [];
      mf.childNodes.forEach(n => {
        const wrap = (txt, tag) => txt.split(/(\s+)/).forEach(w => { if (!w) return; words.push(w.trim() ? '<span class="mw">' + (tag ? '<' + tag + '>' + w + '</' + tag + '>' : w) + '</span>' : ' '); });
        if (n.nodeType === 3) wrap(n.textContent); else wrap(n.textContent, n.tagName.toLowerCase());
      });
      mf.innerHTML = words.join('');
      gsap.fromTo($$('.mw', mf), { opacity: .2 }, { opacity: 1, stagger: .05, ease: 'none', scrollTrigger: { trigger: mf, start: 'top 80%', end: 'bottom 45%', scrub: true } });
    }

    /* 5 ngôi nhà xếp chồng: thẻ trước thu nhỏ khi thẻ sau phủ lên */
    if (has('.hcard')) mm.add('(min-width: 821px)', () => {
      const cards = $$('.hcard');
      cards.forEach((c, i) => {
        if (i === cards.length - 1) return;
        gsap.to(c, { scale: .94, ease: 'none', scrollTrigger: { trigger: cards[i + 1], start: 'top bottom', end: () => 'top ' + (96 + (i + 1) * 16) + 'px', scrub: true } });
      });
    });

    /* một ngày ở Qhome: đường thời gian chạy theo cuộn */
    if (has('.day-line')) {
      mm.add('(min-width: 761px)', () => { gsap.fromTo('.day-line i', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { trigger: '.day-track', start: 'top 80%', end: 'bottom 60%', scrub: true } }); });
      mm.add('(max-width: 760px)', () => { gsap.fromTo('.day-line i', { scaleY: 0 }, { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.day-track', start: 'top 75%', end: 'bottom 55%', scrub: true } }); });
      gsap.from('.day-stop', { opacity: 0, y: 20, stagger: .12, duration: .8, ease: 'power3.out', scrollTrigger: { trigger: '.day-track', start: 'top 80%' } });
    }
  }

  /* ===================== TRANG CHI NHÁNH ===================== */
  if (page === 'branch') {
    const tlb = gsap.timeline({ defaults: { ease: 'power4.out' } });
    tlb.from('main h1 .line > span', { yPercent: 110, duration: 1.3 })
       .from('main [data-load]', { y: 22, opacity: 0, duration: .9, stagger: .07 }, .25);
    if (has('.bp-hero-arch')) {
      tlb.fromTo('.bp-hero-arch', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 18px 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 18px 18px)', duration: 1.5, ease: 'power3.inOut' }, 0);
      gsap.from('.bp-stat', { y: 20, opacity: 0, duration: .8, stagger: .08, ease: 'power3.out', delay: .6 });
    }
    if (has('.soon-visual .arch')) tlb.fromTo('.soon-visual .arch', { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 18px 18px)' }, { clipPath: 'inset(0% 0% 0% 0% round 999px 999px 18px 18px)', duration: 1.5, ease: 'power3.inOut' }, 0)
                                    .from('.soon-stamp', { scale: .4, opacity: 0, duration: .9, ease: 'back.out(1.6)' }, .9);
  }

  /* ===================== DÙNG CHUNG ===================== */
  $$('[data-split]').forEach(h => {
    const words = []; h.childNodes.forEach(n => {
      if (n.nodeType === 3) n.textContent.split(/(\s+)/).forEach(w => w && words.push(w.trim() ? '<span class="w"><span>' + w + '</span></span>' : ' '));
      else { const tag = n.tagName.toLowerCase(); n.textContent.split(/(\s+)/).forEach(w => w && words.push(w.trim() ? '<span class="w"><span><' + tag + '>' + w + '</' + tag + '></span></span>' : ' ')); }
    });
    h.innerHTML = words.join('');
    $$('.w', h).forEach(w => { w.style.display = 'inline-block'; w.style.overflow = 'hidden'; w.style.verticalAlign = 'top'; w.style.paddingBottom = '.1em'; w.style.marginBottom = '-.1em'; w.firstChild.style.display = 'inline-block'; });
    gsap.from($$('.w > span', h), { yPercent: 105, duration: 1.1, stagger: .045, ease: 'power4.out', scrollTrigger: { trigger: h, start: 'top 85%' } });
  });
  $$('[data-reveal]').forEach(el => gsap.from(el, { y: 36, opacity: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
  $$('[data-speed]').forEach(el => gsap.to(el, { yPercent: +el.dataset.speed, ease: 'none', scrollTrigger: { trigger: el.closest('section'), start: 'top bottom', end: 'bottom top', scrub: true } }));

  if (finePointer) $$('.magnetic').forEach(b => {
    const mx = gsap.quickTo(b, 'x', { duration: .5, ease: 'power3' }), my = gsap.quickTo(b, 'y', { duration: .5, ease: 'power3' });
    b.addEventListener('mousemove', e => { const r = b.getBoundingClientRect(); mx((e.clientX - r.left - r.width / 2) * .25); my((e.clientY - r.top - r.height / 2) * .35); });
    b.addEventListener('mouseleave', () => { mx(0); my(0); });
  });

  addEventListener('load', () => { ScrollTrigger.refresh(); applyHash(); });
})();
