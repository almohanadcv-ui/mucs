/* ============================================================
   تطبيق الواجهة (SPA ديناميكي بلا أطر)
   ============================================================ */
const App = (() => {
  let user = null;
  let prefillNid = null;        // لتعبئة نموذج الطلب من لافتة التجديد
  let pollTimer = null;
  let clockTimer = null;
  let seenNotif = new Set();
  let activeLoad = null;        // دالة تحديث القائمة الحالية (ريل تايم)

  const $ = (s) => document.querySelector(s);
  const el = (h) => { const t = document.createElement('template'); t.innerHTML = h.trim(); return t.content.firstChild; };

  const STATUS = { new: 'جديد', under_review: 'قيد المراجعة', info_required: 'بانتظار معلومات',
    approved: 'معتمد', rejected: 'مرفوض', expired: 'منتهٍ', cancelled: 'ملغي', active: 'فعّال' };
  const ROLE = { applicant: 'مقدّم طلب', reviewer: 'مراجِع', support: 'الدعم الفني',
    supervisor: 'المشرف', general_management: 'الإدارة العامة' };
  const IDTYPE = { national: 'هوية وطنية', iqama: 'إقامة' };
  const FILETYPE = { id_image: 'صورة الهوية/الإقامة', personal_photo: 'الصورة الشخصية',
    resident_report: 'تقرير مقيم', supporting_doc: 'مرفق', permit_file: 'ملف التصريح الرسمي' };
  const hasPerm = (p) => user?.role === 'support' || (user?.permissions || []).includes(p);

  const badge = (s) => `<span class="badge s-${s}">${STATUS[s] || s}</span>`;
  // تاريخ ووقت كامل (يوم/شهر/سنة - ساعة)
  const fmt = (d) => {
    if (!d) return '—';
    const dt = new Date(d.replace(' ', 'T') + (d.includes('Z') ? '' : 'Z'));
    const p = (n) => String(n).padStart(2, '0');
    let h = dt.getHours(); const ap = h < 12 ? 'ص' : 'م'; h = h % 12 || 12;
    return `${p(dt.getDate())}/${p(dt.getMonth() + 1)}/${dt.getFullYear()} - ${p(h)}:${p(dt.getMinutes())} ${ap}`;
  };
  // تاريخ فقط بصيغة يوم/شهر/سنة من YYYY-MM-DD
  const fmtDate = (d) => { if (!d) return '—'; const [y, m, day] = String(d).split('-'); return (day && m && y) ? `${day}/${m}/${y}` : d; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // صوت إشعار قصير (Web Audio)
  let _ac = null;
  function beep() {
    try {
      _ac = _ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = _ac.createOscillator(), g = _ac.createGain();
      o.connect(g); g.connect(_ac.destination);
      o.type = 'sine'; o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, _ac.currentTime);
      g.gain.exponentialRampToValueAtTime(0.15, _ac.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, _ac.currentTime + 0.35);
      o.start(); o.stop(_ac.currentTime + 0.36);
    } catch {}
  }

  function toast(msg, type = '') {
    const t = el(`<div class="toast ${type}">${esc(msg)}</div>`);
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4000);
  }

  async function api(path, { method = 'GET', body, form } = {}) {
    const opts = { method, credentials: 'same-origin', headers: {} };
    if (form) opts.body = form;
    else if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
    const res = await fetch('/api' + path, opts);
    const data = await res.json().catch(() => ({}));
    // جلسة منتهية أثناء الاستخدام (دخول من مكان آخر) → عودة لشاشة الدخول
    if (res.status === 401 && user) { sessionStorage.removeItem('pams-tab'); toast(data.error || 'انتهت الجلسة، يُرجى تسجيل الدخول.', 'error'); setTimeout(() => location.replace('/'), 1300); throw new Error(data.error || 'انتهت الجلسة'); }
    if (!res.ok) throw new Error(data.error || 'حدث خطأ.');
    return data;
  }

  // ---------- المصادقة ----------
  let otpPending = null;
  async function login(e) {
    e.preventDefault(); const f = e.target;
    try {
      const res = await api('/auth/login', { method: 'POST', body: { email: f.email.value, password: f.password.value } });
      if (res.step === 'otp') { otpPending = res.pending; showOtp(res.email); return false; }
      sessionStorage.setItem('pams-tab', '1'); user = res.user; enterApp();
    } catch (err) { toast(err.message, 'error'); }
    return false;
  }
  function showOtp(email) {
    const card = document.querySelector('#auth .auth-card');
    if (!card) return;
    card.innerHTML = `<h1>رمز التحقق</h1>
      <p style="color:#94a3b8;font-size:14px;margin:0 0 18px">أرسلنا رمزاً مكوّناً من 6 أرقام إلى <b dir="ltr">${email}</b>. أدخله للمتابعة.</p>
      <form id="otp-form">
        <div class="field"><input id="otp-code" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="------" dir="ltr" style="text-align:center;letter-spacing:10px;font-size:24px;font-weight:700" /></div>
        <button class="btn block neon" type="submit">تأكيد الدخول</button>
      </form>
      <div style="display:flex;justify-content:space-between;margin-top:14px">
        <button id="otp-resend" style="background:none;border:none;color:#60a5fa;cursor:pointer;font-family:inherit;font-size:13.5px">إعادة إرسال الرمز</button>
        <button id="otp-back" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-family:inherit;font-size:13.5px">رجوع</button>
      </div>`;
    const codeInput = card.querySelector('#otp-code'); codeInput.focus();
    card.querySelector('#otp-form').onsubmit = async (ev) => {
      ev.preventDefault();
      try {
        const r = await api('/auth/verify-otp', { method: 'POST', body: { pending: otpPending, code: codeInput.value } });
        sessionStorage.setItem('pams-tab', '1'); user = r.user; enterApp();
      } catch (err) { toast(err.message, 'error'); }
    };
    card.querySelector('#otp-resend').onclick = async () => {
      try { await api('/auth/resend-otp', { method: 'POST', body: { pending: otpPending } }); toast('تم إرسال رمز جديد ✅', 'success'); }
      catch (err) { toast(err.message, 'error'); }
    };
    card.querySelector('#otp-back').onclick = () => location.reload();
  }
  async function logout() { clearInterval(pollTimer); sessionStorage.removeItem('pams-tab'); await api('/auth/logout', { method: 'POST' }).catch(() => {}); location.reload(); }

  // ---------- القوائم ----------
  const NAV = {
    applicant: [['my-requests', 'طلباتي'], ['new-request', 'طلب جديد'], ['my-permits', 'تصاريحي'], ['notifications', 'الإشعارات']],
    reviewer: [['inbox', 'صندوق الطلبات'], ['permits', 'التصاريح'], ['dashboard', 'اللوحة'], ['workflow', 'سير العمل'], ['notifications', 'الإشعارات']],
    supervisor: [['supervisor', 'مقدمي الطلب'], ['undertakings', 'التعهّدات'], ['workflow', 'سير العمل'], ['dashboard', 'اللوحة'], ['permits', 'التصاريح'], ['new-request', 'تقديم طلب']],
    general_management: [['management', 'الإدارة العامة'], ['workflow', 'سير العمل']],
    support: [['management', 'الإدارة العامة'], ['dashboard', 'اللوحة'], ['inbox', 'الطلبات'], ['permits', 'التصاريح'],
              ['users', 'المستخدمون'], ['undertakings', 'التعهّدات'], ['permissions', 'الصلاحيات'], ['workflow', 'سير العمل'], ['system-health', 'صحة النظام'],
              ['settings', 'الإعدادات'], ['database', 'قاعدة البيانات'], ['officers', 'الأداء'], ['audit', 'سجل التدقيق'], ['notifications', 'الإشعارات']],
  };
  // عناصر قائمة تظهر عند منح المستخدم الصلاحية المقابلة (إضافةً لقائمة دوره)
  const PERM_NAV = {
    view_dashboard: ['dashboard', 'اللوحة'],
    view_statistics: ['management', 'الإدارة العامة'],
    supervise_applicants: ['supervisor', 'مقدمي الطلب'],
    create_requests: ['new-request', 'طلب جديد'],
    manage_users: ['users', 'المستخدمون'],
    manage_permissions: ['permissions', 'الصلاحيات'],
    manage_settings: ['settings', 'الإعدادات'],
    manage_whatsapp: ['settings', 'الإعدادات'],
    view_audit_logs: ['audit', 'سجل التدقيق'],
    view_system_health: ['system-health', 'صحة النظام'],
  };
  // قائمة المستخدم = قائمة دوره + العناصر التي يملك صلاحيتها (بلا تكرار، مع إبقاء الإشعارات أخيراً)
  function userNav() {
    const base = (NAV[user.role] || NAV.applicant).slice();
    const keys = new Set(base.map(([k]) => k));
    const tailNotif = keys.has('notifications') ? 1 : 0;
    let off = 0;
    for (const [perm, item] of Object.entries(PERM_NAV)) {
      if ((user.permissions || []).includes(perm) && !keys.has(item[0])) {
        base.splice(base.length - tailNotif + off, 0, item); keys.add(item[0]); off++;
      }
    }
    return base;
  }

  function enterApp() {
    $('#auth').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#app').classList.remove('undertaking-only');
    $('#user-name').textContent = user.full_name;
    $('#user-role').textContent = ROLE[user.role] || user.role;
    const nav = $('#nav'); nav.innerHTML = '';
    for (const [key, label] of userNav()) {
      const a = el(`<a href="#${key}"><span class="nav-ico">${navIcon(key)}</span><span>${label}</span></a>`);
      a.onclick = (e) => { e.preventDefault(); toggleNav(false); route(key); };
      nav.appendChild(a);
    }
    installEnterpriseActions();
    if (user.needs_undertaking) return showUndertaking();
    route(userNav()[0][0]);
    const bell = $('#bell');
    if (bell) bell.classList.toggle('hidden', user.role === 'general_management');
    if (user.role !== 'general_management') startNotifications();
    if (user.role === 'applicant') checkRenewalBanner();
    else checkReviewerExpiry();
    startSubmissionBanner();
    maybeStartTour();
  }
  function navIcon(key) {
    return ({ management: '⌁', dashboard: '⌂', inbox: '□', permits: '◫', users: '◉', permissions: '⚙',
      workflow: '↳', supervisor: '◎', 'system-health': '◌', settings: '⚙', database: '▦',
      officers: '▥', audit: '◷', notifications: '◔', undertakings: '✍', 'my-requests': '□', 'new-request': '+', 'my-permits': '◫' }[key] || '•');
  }
  function installEnterpriseActions() {
    const actions = $('.topbar .actions');
    if (actions && !$('#theme-toggle')) {
      actions.insertBefore(el('<button class="bell" id="cmd-btn" title="Command Palette" onclick="App.commandPalette()">⌘K</button>'), actions.firstChild);
      actions.insertBefore(el('<button class="bell" id="theme-toggle" title="تبديل الوضع" onclick="App.toggleTheme()">◐</button>'), actions.firstChild);
    }
  }
  function toggleNav(force) { $('#app').classList.toggle('nav-open', force === undefined ? undefined : force); }
  function setActive(key) {
    document.querySelectorAll('#nav a').forEach((a) => a.classList.toggle('active', a.getAttribute('href') === '#' + key));
  }
  function setSubtitle() {
    const sub = $('#page-subtitle');
    if (sub) sub.textContent = new Date().toLocaleString('ar-EG',
      { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function route(key) {
    setActive(key);
    $('#page-actions').innerHTML = '';
    activeLoad = null;          // تُعاد ضبطها داخل العروض التي تدعم التحديث التلقائي
    setSubtitle();
    const views = { 'my-requests': viewMyRequests, 'new-request': viewNewRequest, 'notifications': viewNotifications,
      'my-permits': viewMyPermits, 'inbox': viewInbox, 'permits': viewPermits, 'dashboard': viewDashboard,
      'management': viewManagement, 'supervisor': viewSupervisor, 'workflow': viewWorkflow, 'permissions': viewPermissions,
      'system-health': viewSystemHealth, 'users': viewUsers, 'officers': viewOfficers, 'audit': viewAudit, 'settings': viewSettings, 'database': viewDatabase, 'undertakings': viewUndertakings };
    (views[key] || (() => {}))();
  }
  function refreshCurrent() { const a = document.querySelector('#nav a.active'); if (a) route(a.getAttribute('href').slice(1)); }
  function refresh() {
    const b = $('#refresh-btn'); if (b) { b.classList.add('spin'); setTimeout(() => b.classList.remove('spin'), 500); }
    if (activeLoad) activeLoad(); else refreshCurrent();
  }

  // ---------- ريل تايم: إشعارات + تحديث تلقائي للقوائم + ساعة حيّة ----------
  async function startLive() {
    await pollNotifications(true);
    clearInterval(pollTimer); clearInterval(clockTimer);
    pollTimer = setInterval(tick, 4000);      // تحديث شبه فوري كل 4 ثوانٍ
    clockTimer = setInterval(setSubtitle, 20000);
  }
  function tick() {
    pollNotifications(false);
    // حدّث القائمة الحالية تلقائياً ما لم تكن هناك نافذة مفتوحة
    if (activeLoad && !$('#modal-root').innerHTML.trim()) { try { activeLoad(); } catch {} }
  }
  async function startNotifications() { return startLive(); }
  async function pollNotifications(initial) {
    try {
      const { rows } = await api('/notifications');
      const unread = rows.filter((n) => !n.is_read);
      const badgeEl = $('#bell-count');
      if (unread.length) { badgeEl.textContent = unread.length; badgeEl.classList.remove('hidden'); }
      else badgeEl.classList.add('hidden');
      if (!initial) {
        let isNew = false;
        for (const n of unread) if (!seenNotif.has(n.id)) { toast('🔔 ' + n.title, 'success'); isNew = true; }
        if (isNew) beep();
      }
      rows.forEach((n) => seenNotif.add(n.id));
    } catch {}
  }

  async function checkRenewalBanner() {
    try {
      const r = await api('/permits/renewal-status');
      const b = $('#banner');
      if (!r.expiring || !r.items.length) { b.innerHTML = ''; return; }
      renderExpiryBanner(b, r.items, true);
    } catch {}
  }
  async function checkReviewerExpiry() {
    try {
      const r = await api('/permits/expiring-soon');
      const b = $('#banner');
      if (!r.expiring || !r.items.length) { b.innerHTML = ''; return; }
      renderExpiryBanner(b, r.items, false);
    } catch {}
  }
  // لافتة التصاريح المنتهية — تعرض اسم الشخص، مرتّبة بالأقدم انتهاءً، وتُطوى إن زادت عن 5
  function renderExpiryBanner(container, items, renewable) {
    const many = items.length > 5;
    const itemBtn = (p, i) => `<button class="btn sm renew-item" data-i="${i}">🔄 ${esc(p.holder_name || p.permit_number)} — ينتهي ${fmtDate(p.valid_to)} (خلال ${Math.max(0, p.daysLeft)} يوم)</button>`;
    const title = renewable
      ? (items.length > 1 ? `⚠️ لديك <b>${items.length}</b> تصاريح ستنتهي قريباً — اضغط الاسم لتجديده:` : '⚠️ تصريحك سينتهي قريباً — اضغط لتجديده:')
      : `🔔 يوجد <b>${items.length}</b> تصاريح ستنتهي قريباً:`;
    container.innerHTML = `<div class="banner warn"><div style="flex:1">
      <div style="margin-bottom:8px;display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <span>${title}</span>
        ${many ? `<button class="btn sm ghost" id="exp-toggle">عرض القائمة (${items.length})</button>` : ''}
      </div>
      <div class="renew-list ${many ? 'collapsed' : ''}" id="exp-list">${items.map(itemBtn).join('')}</div>
    </div></div>`;
    if (many) {
      const list = container.querySelector('#exp-list'), tg = container.querySelector('#exp-toggle');
      tg.onclick = () => { list.classList.toggle('collapsed'); tg.textContent = list.classList.contains('collapsed') ? `عرض القائمة (${items.length})` : 'إخفاء القائمة'; };
    }
    container.querySelectorAll('.renew-item').forEach((btn) => btn.onclick = () => {
      const p = items[Number(btn.dataset.i)];
      if (renewable) { prefillNid = p.national_id; route('new-request'); }
      else openPermit(p.id);
    });
  }

  function fmtCountdown(seconds) {
    seconds = Math.max(0, Number(seconds) || 0);
    const h = Math.floor(seconds / 3600), m = Math.floor((seconds % 3600) / 60), s = seconds % 60;
    return h ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  let submitBannerTimer = null;
  async function startSubmissionBanner() {
    clearInterval(submitBannerTimer);
    if (!['applicant', 'reviewer', 'supervisor'].includes(user?.role)) return;
    const draw = async () => {
      const b = $('#banner'); if (!b) return;
      try {
        const w = await api('/requests/submission-window/status');
        b.innerHTML = `<div class="banner intake ${w.allowed ? 'open' : 'closed'}">
          <div><b>${esc(w.message)}</b><div class="hint">${w.allowed ? 'نافذة الإرسال مفتوحة الآن.' : esc(w.reason || 'الإرسال مغلق حالياً.')}</div></div>
          <div class="countdown">${fmtCountdown(w.secondsRemaining)}</div>
        </div>`;
        document.querySelectorAll('#submit-btn').forEach((btn) => {
          btn.disabled = !w.allowed || w.spam?.blocked;
          if (!w.allowed) btn.textContent = w.reason || 'الإرسال مغلق';
          else if (w.spam?.blocked) btn.textContent = 'يرجى الانتظار 02:00';
        });
      } catch {}
    };
    await draw();
    submitBannerTimer = setInterval(draw, 1000);
  }

  async function showUndertaking() {
    $('#app').classList.add('undertaking-only');
    $('#page-title').textContent = 'تعهد الاستخدام';
    $('#banner').innerHTML = '';
    $('#page-actions').innerHTML = '';
    let utext = { title: 'تعهد مقدم الطلب', body: '' };
    try { utext = await api('/auth/undertaking-text'); } catch {}
    const ubody = esc(utext.body || '').replace(/\{name\}/g, esc(user.full_name))
      .split(/\n{1,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${p}</p>`).join('');
    $('#content').innerHTML = `<div class="undertaking-shell">
      <div class="undertaking-doc">
        <div class="undertaking-kicker">نموذج استلام عهدة كمبيوتر</div>
        <h2>${esc(utext.title || 'تعهد مقدم الطلب')}</h2>
        <p>التاريخ: ${new Date().toLocaleDateString('ar-SA')}</p>
        <p>بيانات الموظف المستلم: الاسم: <b>${esc(user.full_name)}</b></p>
        ${ubody}
      </div>
      <form class="card undertaking-form" id="undertaking-form">
        <div class="signature-head"><span>✎</span><b>وقّع هنا بالقلم</b></div>
        <canvas id="signature-pad" class="signature-pad" aria-label="منطقة التوقيع"></canvas>
        <div class="signature-actions">
          <button class="btn ghost" type="button" id="sig-clear">مسح التوقيع</button>
          <button class="btn block" type="submit">إرسال التعهد</button>
        </div>
      </form></div>`;
    const canvas = $('#signature-pad');
    const ctx = canvas.getContext('2d');
    let drawing = false, signed = false;
    function resizeSignature() {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#eaf2ff';
    }
    function point(ev) {
      const p = ev.touches?.[0] || ev;
      const r = canvas.getBoundingClientRect();
      return { x: p.clientX - r.left, y: p.clientY - r.top };
    }
    function start(ev) { ev.preventDefault(); drawing = true; signed = true; const p = point(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(ev) { if (!drawing) return; ev.preventDefault(); const p = point(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); }
    function end() { drawing = false; }
    resizeSignature();
    window.addEventListener('resize', resizeSignature, { once: true });
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', end);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); canvas.addEventListener('touchend', end);
    $('#sig-clear').onclick = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); signed = false; };
    $('#undertaking-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!signed) { toast('وقّع داخل المربع أولاً.', 'error'); return; }
      try {
        const r = await api('/auth/undertaking', { method: 'POST', body: { full_name: user.full_name, signed_at: new Date().toISOString(), signature: canvas.toDataURL('image/png') } });
        user = r.user;
        toast('تم حفظ التعهد واعتماده', 'success');
        $('#app').classList.remove('undertaking-only');
        route(userNav()[0][0]);
        startSubmissionBanner();
        maybeStartTour();
      } catch (err) { toast(err.message, 'error'); }
    };
  }

  function maybeStartTour() {
    if (!user?.needs_tour || user.needs_undertaking) return;
    const byRole = {
      applicant: [
        { route: 'my-requests', target: '#nav a[href="#my-requests"]', title: 'طلباتي', body: 'هنا تتابع كل طلب أرسلته وحالته. اضغط على طلباتي للمتابعة.', click: true },
        { route: 'my-requests', target: '#nav a[href="#new-request"]', title: 'طلب جديد', body: 'لإنشاء تصريح جديد اضغط طلب جديد من القائمة.', click: true },
        { route: 'new-request', target: 'input[name="first_name"]', title: 'تعبئة البيانات', body: 'عبّئ بيانات الشخص: رقم الهوية، الاسم بالإنجليزي، تاريخ الميلاد، وتاريخ نهاية الهوية. عبّأنا لك بيانات تجريبية كمثال.', next: true,
          prepare: () => {
            const set = (n, v) => { const x = $(`[name="${n}"]`); if (x && !x.value) x.value = v; };
            set('national_id', '1058471324'); set('first_name', 'Mohammed'); set('last_name', 'Ali');
            set('dob', '1990-05-10'); set('doc_expiry', '2030-01-15'); set('employee_no', '1024');
            set('purpose', 'زيارة موقع العمل لإنهاء مهمة تشغيلية.');
          } },
        { route: 'new-request', target: 'input[name="id_image"]', title: 'إضافة الصور', body: 'ارفع صورة الهوية أو الإقامة، ثم الصورة الشخصية، وتقرير المقيم للإقامة. (هذه أمثلة تعليمية — في الواقع تختار الملفات من جهازك).', next: true },
        { route: 'new-request', target: '#add-person', title: 'إضافة شخص آخر', body: 'اضغط هذا الزر بعد تعبئة الأول ليُضاف للقائمة، ثم عبّئ الشخص الثاني — وهكذا. عبّأنا لك شخصاً ثانياً كمثال، والأول ظهر بالقائمة.', next: true,
          prepare: () => {
            const list = $('#people-list');
            if (list) { list.classList.remove('hidden'); list.innerHTML = '<div class="hint ok" style="margin-bottom:6px">✅ مثال تعليمي: تم تسجيل شخص</div><div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1c2541;border-radius:8px"><span style="flex:1">1. Mohammed Ali — 1058471324</span><button type="button" class="btn sm danger">حذف</button></div>'; }
            const set = (n, v) => { const x = $(`[name="${n}"]`); if (x) x.value = v; };
            set('national_id', '2412345678'); set('first_name', 'Khaled'); set('last_name', 'Omar');
            set('dob', '1992-03-22'); set('doc_expiry', '2029-11-05'); set('employee_no', '1025');
          } },
        { route: 'new-request', target: '#submit-btn', title: 'إرسال الطلب', body: 'بعد اكتمال البيانات والمرفقات اضغط إرسال الطلب. الإرسال متاح من 8 صباحاً حتى 1 ظهراً.', next: true },
        { route: 'my-permits', target: '#nav a[href="#my-permits"]', title: 'تصاريحي', body: 'بعد الاعتماد ستظهر تصاريحك هنا ويمكنك متابعة صلاحيتها وتجديدها وقت الحاجة.', click: true },
      ],
      reviewer: [
        { route: 'inbox', target: '#nav a[href="#inbox"]', title: 'صندوق الطلبات', body: 'تبدأ مراجعتك من هنا. اضغط صندوق الطلبات لعرض الطلبات الواردة.', click: true },
        { route: 'inbox', target: '#content table tbody tr, #content .card', title: 'فتح الطلب', body: 'افتح الطلب لمراجعة البيانات والمرفقات، ثم ابدأ المراجعة حسب الحالة.', next: true },
        { route: 'permits', target: '#nav a[href="#permits"]', title: 'التصاريح', body: 'من هنا تتابع التصاريح الصادرة وملفاتها وتواريخ انتهائها.', click: true },
        { route: 'dashboard', target: '#nav a[href="#dashboard"]', title: 'اللوحة', body: 'اللوحة تعطيك أرقام العمل اليومية وحالة الطلبات.', click: true },
        { route: 'workflow', target: '#nav a[href="#workflow"]', title: 'سير العمل', body: 'هنا تشاهد دورة التصريح من الإرسال حتى الاعتماد والإصدار.', click: true },
      ],
      supervisor: [
        { route: 'supervisor', target: '#nav a[href="#supervisor"]', title: 'مقدمي الطلب', body: 'هذه الصفحة مخصصة لمتابعة مقدمي الطلب فقط ونشاطهم.', click: true },
        { route: 'new-request', target: '#nav a[href="#new-request"]', title: 'تقديم طلب', body: 'عند إجازة مقدمي الطلب تستطيع تقديم طلب بنفس نموذجهم.', click: true },
        { route: 'dashboard', target: '#nav a[href="#dashboard"]', title: 'اللوحة', body: 'تابع المؤشرات العامة دون الدخول في صلاحيات إدارة المستخدمين.', click: true },
        { route: 'permits', target: '#nav a[href="#permits"]', title: 'التصاريح', body: 'استعرض التصاريح الصادرة وحالة صلاحيتها.', click: true },
        { route: 'workflow', target: '#nav a[href="#workflow"]', title: 'سير العمل', body: 'راجع مراحل العمل من الطلب حتى إصدار التصريح.', click: true },
      ],
      general_management: [
        { route: 'management', target: '#nav a[href="#management"]', title: 'الإدارة العامة', body: 'هذه لوحة الإدارة العامة للمؤشرات والمواقع الأعلى طلباً.', click: true },
        { route: 'management', target: '.destination-map', title: 'أكثر المواقع', body: 'الخريطة تعرض أكثر المواقع التي ذهبت لها التصاريح مثل GRAND HOTEL و WATER PARK HOTEL.', next: true },
        { route: 'workflow', target: '#nav a[href="#workflow"]', title: 'سير العمل', body: 'من هنا تشاهد سير العملية بشكل مرتب ومختصر.', click: true },
      ],
    };
    const steps = byRole[user.role] || byRole.applicant;
    let i = 0, currentStep = null;

    const cleanup = () => {
      document.removeEventListener('click', guardClick, true);
      document.querySelectorAll('.tour-target').forEach((x) => x.classList.remove('tour-target'));
    };
    const finish = async () => {
      cleanup();
      document.body.classList.remove('tour-active');
      try { const r = await api('/auth/tour-complete', { method: 'POST' }); user = r.user; } catch {}
      closeModal();
    };
    const repeat = () => { i = 0; render(); };
    const done = () => {
      cleanup();
      $('#modal-root').innerHTML = `<div class="tour-overlay">
        <div class="tour-card">
          <h3>هل الشرح واضح؟</h3>
          <p>اختر فهمت لإغلاق الجولة نهائياً، أو أعد الشرح لإعادتها من البداية.</p>
          <div class="tour-actions">
            <button class="btn ghost" id="tour-repeat">أعد الشرح</button>
            <button class="btn" id="tour-finish">فهمت</button>
          </div>
        </div></div>`;
      $('#tour-repeat').onclick = repeat;
      $('#tour-finish').onclick = finish;
    };
    function guardClick(e) {
      if (!currentStep?.click) return;
      const target = document.querySelector(currentStep.target);
      if (target && target.contains(e.target)) {
        setTimeout(() => { i++; render(); }, 120);
        return;
      }
      e.preventDefault(); e.stopPropagation();
      toast('اضغط على العنصر المحدد لإكمال الشرح.', 'error');
    }
    function place(step) {
      cleanup();
      currentStep = step;
      step.prepare?.();
      const target = document.querySelector(step.target);
      if (target) target.classList.add('tour-target');
      const r = target?.getBoundingClientRect();
      const top = r ? Math.max(16, Math.min(window.innerHeight - 220, r.bottom + 12)) : Math.round(window.innerHeight / 2 - 110);
      const left = r ? Math.max(16, Math.min(window.innerWidth - 390, r.left)) : Math.round(window.innerWidth / 2 - 190);
      const ring = r
        ? `<div class="tour-ring" style="top:${Math.max(8, r.top - 8)}px;left:${Math.max(8, r.left - 8)}px;width:${r.width + 16}px;height:${r.height + 16}px"></div>`
        : '';
      $('#modal-root').innerHTML = `<div class="tour-guide">
        <div class="tour-dim"></div>${ring}
        <div class="tour-tip" style="top:${top}px;left:${left}px">
          <div class="tour-step">${i + 1} / ${steps.length}</div>
          <h3>${esc(step.title)}</h3><p>${esc(step.body)}</p>
          ${step.next ? `<div class="tour-actions"><button class="btn" id="tour-next">التالي</button></div>` : '<div class="tour-hint">اضغط على العنصر المحدد</div>'}
        </div></div>`;
      if (step.next) $('#tour-next').onclick = () => { i++; render(); };
      if (step.click) document.addEventListener('click', guardClick, true);
    }
    function render() {
      if (i >= steps.length) return done();
      const step = steps[i];
      route(step.route);
      setTimeout(() => place(step), 450);
    }
    document.body.classList.add('tour-active');
    setTimeout(render, 700);
  }

  function applyTheme() {
    const theme = localStorage.getItem('mab-theme') || 'dark';
    document.body.classList.toggle('dark', theme === 'dark');
    document.body.classList.toggle('light', theme !== 'dark');
  }
  function toggleTheme() {
    localStorage.setItem('mab-theme', document.body.classList.contains('dark') ? 'light' : 'dark');
    applyTheme();
  }
  function commandPalette() {
    const items = userNav().map(([key, label]) => ({ key, label }));
    showModal('Command Palette', `<div class="field"><input id="cmd-search" placeholder="ابحث عن صفحة أو إجراء..." autofocus /></div>
      <div class="cmd-list">${items.map((it) => `<button class="cmd-item" data-route="${it.key}"><span>${navIcon(it.key)}</span>${esc(it.label)}</button>`).join('')}</div>`);
    $('#cmd-search').oninput = (e) => {
      const q = e.target.value.trim();
      document.querySelectorAll('.cmd-item').forEach((b) => b.classList.toggle('hidden', q && !b.textContent.includes(q)));
    };
    document.querySelectorAll('.cmd-item').forEach((b) => b.onclick = () => { closeModal(); route(b.dataset.route); });
  }

  // ============================================================
  //  التعهّدات الموقّعة (الدعم + المشرف)
  // ============================================================
  async function viewUndertakings() {
    $('#page-title').textContent = 'التعهّدات الموقّعة';
    const c = $('#content'); c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    let data, txt;
    try { [data, txt] = await Promise.all([api('/users/undertakings'), api('/auth/undertaking-text')]); }
    catch (e) { c.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    const rows = data.rows || [];
    c.innerHTML = `<div class="card" style="overflow:auto">
      <div class="muted" style="margin-bottom:12px">عدد التعهّدات الموقّعة: <b>${rows.length}</b></div>
      <table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr>${['الاسم', 'البريد', 'تاريخ التوقيع', 'التوقيع', ''].map((h) => `<th style="text-align:right;border-bottom:2px solid var(--v2-line);padding:9px">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map((r, i) => `<tr>
          <td style="padding:9px;border-bottom:1px solid var(--v2-line)">${esc(r.undertaking_name || r.full_name)}</td>
          <td style="padding:9px;border-bottom:1px solid var(--v2-line)" dir="ltr">${esc(r.email)}</td>
          <td style="padding:9px;border-bottom:1px solid var(--v2-line)">${esc((r.undertaking_accepted_at || '').slice(0, 16))}</td>
          <td style="padding:9px;border-bottom:1px solid var(--v2-line)">${r.undertaking_signature ? `<img src="${r.undertaking_signature}" style="height:36px;background:#fff;border-radius:6px;padding:2px 6px">` : '—'}</td>
          <td style="padding:9px;border-bottom:1px solid var(--v2-line)"><button class="btn sm" data-i="${i}">عرض / PDF</button></td></tr>`).join('')
        : '<tr><td colspan="5" style="padding:18px;text-align:center;color:var(--v2-muted)">لا توجد تعهّدات موقّعة بعد.</td></tr>'}</tbody>
      </table></div>`;
    c.querySelectorAll('[data-i]').forEach((b) => b.onclick = () => openUndertakingPrint(rows[+b.dataset.i], txt));
  }
  function openUndertakingPrint(r, txt) {
    const name = r.undertaking_name || r.full_name;
    const date = (r.undertaking_accepted_at || '').slice(0, 10);
    const body = esc(txt.body || '').replace(/\{name\}/g, esc(name)).split(/\n{1,}/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${p}</p>`).join('');
    const logo = `${location.origin}/assets/logo.png`;
    const w = window.open('', '_blank');
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(txt.title || 'تعهّد')} - ${esc(name)}</title>
      <style>
        @page{size:A4;margin:16mm}
        *{box-sizing:border-box} html,body{margin:0;padding:0}
        body{font-family:Tahoma,'Segoe UI',Arial,sans-serif;color:#1a1a1a;line-height:1.9;font-size:14px}
        .page{max-width:720px;margin:0 auto;padding:24px 28px}
        .head{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1f6fc2;padding-bottom:12px}
        .head img{height:44px;width:auto;max-width:150px}
        .head .cont{color:#1f6fc2;font-weight:bold;font-size:12px;letter-spacing:.5px}
        h1{text-align:center;font-size:20px;margin:22px 0 16px;color:#111}
        .meta{font-weight:bold;font-size:14px;margin:5px 0}
        .rule{border:none;border-top:1px solid #cfcfcf;margin:14px 0}
        .iqrar{font-weight:bold;margin-top:14px;font-size:15px}
        .body p{margin:7px 0;font-size:14px}
        .sig{margin-top:30px;font-weight:bold}
        .sig img{display:block;height:74px;width:auto;max-width:220px;margin-top:6px}
        .foot{margin-top:30px;border-top:2px solid #1f6fc2;padding-top:10px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;color:#555;font-size:11.5px;direction:ltr}
        .btn{margin:18px auto 0;display:block;padding:10px 24px;background:#1f6fc2;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-weight:bold;font-size:13px}
        @media print{.btn{display:none}}
      </style></head><body><div class="page">
        <div class="head"><img src="${logo}" alt="MAB" onerror="this.style.display='none'"><div class="cont">TRADING &amp; CONTRACTING</div></div>
        <h1>${esc(txt.title || 'نموذج استلام عهدة كمبيوتر')}</h1>
        <div class="meta">التاريخ: ${esc(date)}</div>
        <div class="meta">بيانات الموظف المستلم — الاسم: ${esc(name)}</div>
        <hr class="rule">
        <div class="iqrar">إقرار:</div>
        <div class="body">${body}</div>
        <div class="sig">التوقيع:${r.undertaking_signature ? `<img src="${r.undertaking_signature}" alt="التوقيع">` : ' ____________'}</div>
        <div class="foot"><span>P.O.Box 7630, Post Code 12476 - Riyadh - KSA</span><span>011 480 9816</span><span>C.R. 1010640928</span></div>
        <button class="btn" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
      </div></body></html>`);
    w.document.close();
  }

  // ============================================================
  //  مقدّم الطلب — طلباتي
  // ============================================================
  async function viewMyRequests() {
    $('#page-title').textContent = 'طلباتي';
    $('#page-actions').appendChild(btn('➕ طلب جديد', () => route('new-request')));
    const c = $('#content');
    let page = 1; const pageSize = 10;
    const load = async () => {
      const { rows, total } = await api('/requests?' + new URLSearchParams({ page, pageSize }));
      c.innerHTML = ''; c.appendChild(requestsTable(rows));
      c.appendChild(paginationBar(total, page, pageSize, (p) => { page = p; load(); }));
    };
    activeLoad = load;
    c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    load();
  }

  // ============================================================
  //  نموذج طلب جديد
  // ============================================================
  function viewNewRequest() {
    const renewalNid = prefillNid; prefillNid = null;
    if (renewalNid) return viewRenewRequest(renewalNid);

    $('#page-title').textContent = 'تقديم طلب تصريح جديد';
    const c = $('#content'); c.innerHTML = '';
    const form = el(`
      <form class="card" id="req-form" style="max-width:720px">
        <div class="row">
          <div class="field"><label>نوع الوثيقة *</label>
            <select name="id_type"><option value="national">هوية وطنية</option><option value="iqama">إقامة</option></select></div>
          <div class="field"><label id="nid-label">رقم الهوية *</label>
            <input name="national_id" required inputmode="numeric" placeholder="1xxxxxxxxx" />
            <div class="hint" id="nid-hint"></div></div>
        </div>
        <div class="field"><label>اسم مقدّم الطلب</label>
          <input value="${esc(user.full_name)}" readonly />
          <div class="hint">ثابت ومرتبط بحسابك.</div></div>
        <div class="hint" id="ben-hint" style="margin:2px 0 8px">يُكتب الاسم بالأحرف الإنجليزية فقط (كما في الهوية).</div>
        <div class="row">
          <div class="field"><label>الاسم الأول * <span class="note-red">English</span></label>
            <input name="first_name" required dir="ltr" pattern="[A-Za-z][A-Za-z .'\\-]*" title="English letters only"
              placeholder="First name" style="text-align:left" /></div>
          <div class="field"><label>اسم العائلة * <span class="note-red">English</span></label>
            <input name="last_name" required dir="ltr" pattern="[A-Za-z][A-Za-z .'\\-]*" title="English letters only"
              placeholder="Last name" style="text-align:left" /></div>
        </div>
        <div class="row">
          <div class="field"><label>تاريخ الميلاد <span class="note-red">ميلادي / Gregorian</span></label>
            <input name="dob" dir="ltr" placeholder="مثال: 1990-05-10" style="text-align:left" /></div>
          <div class="field"><label>تاريخ نهاية <span id="docexp-doc">الهوية</span> * <span class="note-red">ميلادي / Gregorian</span></label>
            <input name="doc_expiry" required dir="ltr" placeholder="مثال: 2027-08-15" style="text-align:left" /></div>
        </div>
        <div class="row">
          <div class="field"><label>موقع الزيارة في القدية *</label>
            <select name="visit_location">
              <option value="WATER PARK HOTEL">WATER PARK HOTEL</option>
              <option value="GRAND HOTEL">GRAND HOTEL</option>
            </select></div>
          <div class="field hidden" id="nationality-field"><label>الجنسية * <span class="note-red">English — للإقامة</span></label>
            <input name="nationality" dir="ltr" placeholder="e.g. Indian / Egyptian" style="text-align:left" /></div>
        </div>
        <div class="field"><label>رقم الموظف <span class="hint" style="display:inline">(اختياري)</span></label>
          <input name="employee_no" dir="ltr" placeholder="#" style="text-align:left" /></div>
        <div class="field"><label>الكفالة *</label>
          <div class="radio-box">
            <label class="radio"><input type="radio" name="sponsorship" value="mab" checked /> على كفالة شركة ماب (MAB)</label>
            <label class="radio"><input type="radio" name="sponsorship" value="other" /> على كفالة شركة أخرى</label>
          </div>
          <input name="sponsor_company" id="sponsor-company" class="hidden" placeholder="اسم الشركة الكفيلة (اختياري)" style="margin-top:10px" />
        </div>
        <div class="field"><label>السبب / ملاحظة <span class="hint" style="display:inline">(اختياري — يظهر خارج القالب الرسمي)</span></label>
          <textarea name="purpose" placeholder="اكتب أي ملاحظة أو سبب إضافي (اختياري)…"></textarea></div>
        <div class="field">
          <label>صورة الهوية / الإقامة * (JPG / PNG / PDF) <span class="note-red">⚠ الهوية والإقامة من أبشر فقط</span></label>
          <input type="file" name="id_image" accept="image/*,application/pdf" required /></div>
        <div class="field"><label>الصورة الشخصية * (إلزامية للسعودي والمقيم)</label>
          <input type="file" name="personal_photo" accept="image/*" required /></div>
        <div class="field hidden" id="resident-field">
          <label>تقرير مقيم * <span class="note-red">إلزامي للإقامة</span></label>
          <input type="file" name="resident_report" accept="image/*,application/pdf" /></div>
        <div class="field"><label>مرفقات إضافية (اختياري، حتى 5 ملفات)</label>
          <input type="file" name="documents" accept="image/*,application/pdf" multiple /></div>
        <div id="people-list" class="hidden" style="margin:4px 0 12px"></div>
        <button class="btn ghost block" type="button" id="add-person" style="margin-bottom:10px">➕ إضافة شخص آخر للطلب</button>
        <button class="btn block" type="submit" id="submit-btn">إرسال الطلب</button>
      </form>`);
    c.appendChild(form);

    // تجميع عدّة أشخاص في نفس الصفحة: كل شخص يُحفظ ثم يُرفع كطلب مستقل عند الإرسال
    const pending = []; // [{ fd, label }]
    const peopleList = form.querySelector('#people-list');
    const addBtn = form.querySelector('#add-person');
    const submitBtn = form.querySelector('#submit-btn');

    function renderPeople() {
      peopleList.classList.toggle('hidden', !pending.length);
      submitBtn.textContent = pending.length ? `📤 إرسال (${pending.length} مسجّل${currentFilled() ? ' + الحالي' : ''})` : 'إرسال الطلب';
      peopleList.innerHTML = pending.length
        ? `<div class="hint ok" style="margin-bottom:6px">✅ تم تسجيل ${pending.length} شخص — أكمل الباقي ثم اضغط إرسال:</div>`
          + pending.map((p, i) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#1c2541;border-radius:8px;margin-bottom:6px">
              <span style="flex:1">${i + 1}. ${esc(p.label)}</span>
              <button type="button" class="btn sm danger" data-rm="${i}">حذف</button></div>`).join('')
        : '';
      peopleList.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { pending.splice(+b.dataset.rm, 1); renderPeople(); });
    }
    function currentFilled() { return !!(form.national_id.value.trim() || form.first_name.value.trim()); }
    function snapshotPerson() {
      if (!form.reportValidity()) return null;
      const nidVal = form.national_id.value.trim();
      const fd = new FormData(form); fd.append('renewal', 'false');
      const label = `${form.first_name.value} ${form.last_name.value}`.trim() + ` — ${nidVal}`;
      return { fd, label, nid: nidVal };
    }
    function resetPersonFields() {
      ['national_id', 'first_name', 'last_name', 'dob', 'doc_expiry', 'nationality', 'employee_no', 'purpose', 'sponsor_company']
        .forEach((n) => { if (form[n]) form[n].value = ''; });
      form.id_image.value = ''; form.personal_photo.value = '';
      if (form.resident_report) form.resident_report.value = '';
      form.documents.value = '';
      // يبقى نوع الوثيقة + موقع الزيارة + الكفالة كما هي (لتسهيل التكرار)
    }
    addBtn.onclick = () => {
      const nidVal = form.national_id.value.trim();
      if (nidVal && pending.some((x) => x.nid === nidVal)) { toast('هذا الشخص مُضاف بالفعل في هذه الدفعة — لا داعي لتكراره.', 'error'); return; }
      const p = snapshotPerson(); if (!p) return;
      pending.push(p); resetPersonFields(); renderPeople();
      toast(`أُضيف: ${p.label}. عبّئ بيانات الشخص التالي.`, 'success');
      form.national_id.focus();
    };
    form.national_id.addEventListener('input', renderPeople);
    form.first_name.addEventListener('input', renderPeople);

    const nid = form.national_id, type = form.id_type, hint = form.querySelector('#nid-hint'),
      lbl = form.querySelector('#nid-label'), residentField = form.querySelector('#resident-field'),
      residentInput = form.resident_report, companyInput = form.querySelector('#sponsor-company'),
      nationalityField = form.querySelector('#nationality-field'), nationalityInput = form.nationality;

    const toggleResident = () => {
      const iq = type.value === 'iqama';
      residentField.classList.toggle('hidden', !iq);
      residentInput.required = iq;
      // الجنسية تظهر وتُطلب للإقامة فقط (الهوية الوطنية = Saudi تلقائياً)
      nationalityField.classList.toggle('hidden', !iq);
      nationalityInput.required = iq;
      lbl.textContent = (iq ? 'رقم الإقامة' : 'رقم الهوية') + ' *';
      const docExpDoc = form.querySelector('#docexp-doc');
      if (docExpDoc) docExpDoc.textContent = iq ? 'الإقامة' : 'الهوية';
    };
    form.querySelectorAll('input[name=sponsorship]').forEach((r) => r.onchange = () => {
      const other = form.sponsorship.value === 'other';
      companyInput.classList.toggle('hidden', !other); // اسم الشركة اختياري
    });

    let timer;
    const check = () => {
      toggleResident();
      clearTimeout(timer); hint.className = 'hint'; hint.textContent = '';
      const v = nid.value.trim(); if (!v) return;
      // مُضاف بالفعل في هذه الدفعة؟ نوقف فوراً قبل سؤال الخادم
      if (pending.some((p) => p.nid === v)) { hint.className = 'hint err'; hint.textContent = '✗ هذا الشخص مُضاف بالفعل في هذه الدفعة.'; return; }
      timer = setTimeout(async () => {
        try {
          const r = await api(`/requests/eligibility/${encodeURIComponent(v)}?type=${type.value}`);
          if (r.eligible && !r.renewal) { hint.className = 'hint ok'; hint.textContent = '✓ يمكن التقديم بهذا الرقم.'; }
          else { hint.className = 'hint err'; hint.textContent = '✗ ' + (r.reason || 'غير متاح'); }
        } catch {}
      }, 400);
    };
    nid.oninput = check; type.onchange = check;
    const benHint = form.querySelector('#ben-hint');
    const validName = (s) => s === '' || /^[A-Za-z][A-Za-z .'\-]*$/.test(s);
    const checkNames = () => {
      const ok = validName(form.first_name.value) && validName(form.last_name.value);
      benHint.className = ok ? 'hint' : 'hint err';
      benHint.textContent = ok ? 'يُكتب الاسم بالأحرف الإنجليزية فقط (كما في الهوية).' : '✗ يجب أن يكون الاسم بالإنجليزية فقط.';
    };
    form.first_name.oninput = checkNames; form.last_name.oninput = checkNames;
    toggleResident();

    // يرسل دفعة (بياناتها محفوظة في الذاكرة) ويعرض النتيجة — يُعاد استدعاؤه عند إعادة المحاولة
    async function submitBatch(batch) {
      submitBtn.disabled = true; addBtn.disabled = true;
      const results = [];
      for (let i = 0; i < batch.length; i++) {
        if (submitBtn.isConnected) submitBtn.textContent = `جارٍ الإرسال… (${i + 1}/${batch.length})`;
        try { const r = await api('/requests', { method: 'POST', form: batch[i].fd }); results.push({ ok: true, item: batch[i], label: batch[i].label, num: r.request_number }); }
        catch (err) { results.push({ ok: false, item: batch[i], label: batch[i].label, msg: err.message }); }
      }
      showSubmitResults(results);
    }

    form.onsubmit = async (e) => {
      e.preventDefault();
      // اجمع كل المسجّلين + الشخص الحالي إن كان معبّأً
      const batch = pending.slice();
      if (currentFilled()) {
        const p = snapshotPerson(); if (!p) return;
        if (p.nid && batch.some((x) => x.nid === p.nid)) { toast('الشخص الحالي مُضاف بالفعل في القائمة — احذف التكرار أو غيّر الرقم.', 'error'); return; }
        batch.push(p);
      }
      if (!batch.length) { toast('أدخل بيانات شخص واحد على الأقل.', 'error'); return; }
      // تأكيد قبل الإرسال
      if (!confirm(batch.length === 1 ? 'هل تريد إرسال الطلب؟' : `سيتم إرسال ${batch.length} طلب. هل تريد التأكيد؟`)) return;
      await submitBatch(batch);
    };

    function showSubmitResults(results) {
      const ok = results.filter((r) => r.ok), fail = results.filter((r) => !r.ok);
      $('#page-title').textContent = 'نتيجة إرسال الطلبات';
      const cc = $('#content'); cc.innerHTML = '';
      const card = el(`<div class="card" style="max-width:720px">
        <div class="hint ok" style="font-size:1.05em">✅ تم رفع ${ok.length} طلب${ok.length ? ':' : ''}</div>
        ${ok.map((r) => `<div style="padding:4px 0">• ${esc(r.label)} — <b>${esc(r.num)}</b></div>`).join('')}
        ${fail.length ? `<div class="hint err" style="margin-top:12px;font-size:1.05em">⛔ تعذّر رفع ${fail.length} (بياناتها محفوظة — اضغط إعادة الإرسال):</div>`
          + fail.map((r) => `<div style="padding:4px 0">• ${esc(r.label)} — ${esc(r.msg)}</div>`).join('') : ''}
        <div class="row" style="gap:10px;margin-top:16px">
          ${fail.length ? `<button class="btn block success" id="res-retry" style="flex:1">🔁 إعادة إرسال الفاشل (${fail.length})</button>` : ''}
          <button class="btn ghost" id="res-again" style="flex:1">➕ طلب جديد</button>
          <button class="btn block" id="res-go" style="flex:1">الذهاب لطلباتي</button>
        </div></div>`);
      cc.appendChild(card);
      card.querySelector('#res-go').onclick = () => route(user.role === 'applicant' ? 'my-requests' : 'supervisor');
      card.querySelector('#res-again').onclick = () => route('new-request');
      const rb = card.querySelector('#res-retry');
      if (rb) rb.onclick = () => submitBatch(fail.map((r) => r.item)); // يعيد إرسال الفاشل فقط ببياناته المحفوظة
    }
  }

  // ---------- إعدادات النظام (دعم) ----------
  async function viewSettings() {
    $('#page-title').textContent = 'إعدادات النظام';
    const c = $('#content'); c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    let s, apps, links;
    try { [s, apps, links] = await Promise.all([api('/wa/settings'), api('/wa/applicants'), api('/wa/links')]); }
    catch (e) { c.innerHTML = `<div class="card">تعذّر التحميل: ${esc(e.message)}</div>`; return; }
    c.innerHTML = '';

    // ===== بطاقة الإعدادات العامة =====
    const form = el(`
      <form class="card" style="max-width:680px">
        <div class="field"><label>أرقام المراجعين</label>
          <input name="reviewerIds" value="${esc(s.reviewerIds)}" dir="ltr" style="text-align:left" placeholder="966500000000,86376204742911" />
          <div class="hint">الأرقام/المعرّفات التي تُرسل التصاريح للوكيل (مفصولة بفاصلة).</div></div>
        <div class="field"><label>مستلمو ملف Excel</label>
          <input name="exportRecipients" value="${esc(s.exportRecipients)}" dir="ltr" style="text-align:left" placeholder="اتركه فارغاً = أول رقم مراجِع" />
          <div class="hint">الأرقام التي يُرسَل لها ملف التصدير (مفصولة بفاصلة). فارغ = يُرسل لأول رقم مراجِع.</div></div>
        <div class="field"><label>الأرقام المسموح لها بالإرسال للوكيل</label>
          <textarea name="allowlist" dir="ltr" style="text-align:left;min-height:90px" placeholder="966500000000,966511111111">${esc(s.allowlist)}</textarea>
          <div class="hint">كل الأرقام المسموح لها بالتواصل مع الوكيل (مفصولة بفاصلة، بصيغة دولية بدون +).</div></div>
        <div class="row" style="gap:12px">
          <div class="field" style="flex:1"><label>بداية استقبال الطلبات</label>
            <input name="submitStart" type="time" value="${esc(s.submitStart || '08:00')}" dir="ltr" /></div>
          <div class="field" style="flex:1"><label>نهاية استقبال الطلبات</label>
            <input name="submitEnd" type="time" value="${esc(s.submitEnd || '13:00')}" dir="ltr" /></div>
        </div>
        <div class="field" style="margin-top:-6px"><div class="hint">خارج هذا الوقت يُقفل زر الإرسال تلقائياً. (بتوقيت الرياض)</div></div>
        <div class="field"><label>نافذة التجديد (أيام قبل انتهاء التصريح)</label>
          <input name="renewalWindowDays" type="number" min="1" value="${esc(String(s.renewalWindowDays || 5))}" dir="ltr" style="text-align:left" />
          <div class="hint">يظهر طلب/زر التجديد للمهندس خلال هذه المدة قبل انتهاء تصريحه (مثلاً 30 يوماً).</div></div>
        <div class="field"><label>عنوان نص التعهّد</label>
          <input name="undertakingTitle" value="${esc(s.undertakingTitle || '')}" /></div>
        <div class="field"><label>نص التعهّد (يظهر لمقدّم الطلب قبل التوقيع)</label>
          <textarea name="undertakingBody" style="min-height:140px">${esc(s.undertakingBody || '')}</textarea>
          <div class="hint">تقدر تعدّل أي نص. استخدم <b dir="ltr">{name}</b> ليُستبدل تلقائياً باسم الموقّع. اترك سطراً فارغاً للفصل بين الفقرات.</div></div>
        <button class="btn block" type="submit">💾 حفظ الإعدادات</button>
      </form>`);
    c.appendChild(form);
    form.onsubmit = async (e) => {
      e.preventDefault();
      const sb = form.querySelector('button[type=submit]'); sb.disabled = true; sb.textContent = 'جارٍ الحفظ…';
      try {
        await api('/wa/settings', { method: 'PUT', body: {
          reviewerIds: form.reviewerIds.value,
          exportRecipients: form.exportRecipients.value,
          allowlist: form.allowlist.value,
          undertakingTitle: form.undertakingTitle.value,
          undertakingBody: form.undertakingBody.value,
          submitStart: form.submitStart.value,
          submitEnd: form.submitEnd.value,
          renewalWindowDays: form.renewalWindowDays.value,
        } });
        toast('تم حفظ الإعدادات ✅ (تُطبّق فوراً)', 'success');
      } catch (err) { toast(err.message, 'error'); }
      sb.disabled = false; sb.textContent = '💾 حفظ الإعدادات';
    };

    // زر تصدير فوري (اختبار إرسال ملف Excel للمستلِمين)
    const exportNow = el('<button class="btn ghost block" style="max-width:680px;margin-top:8px">📤 تصدير للمراجِع الآن (اختبار)</button>');
    exportNow.onclick = async () => {
      exportNow.disabled = true; exportNow.textContent = 'جارٍ التصدير…';
      try {
        const r = await api('/wa/run-export', { method: 'POST' });
        toast(r.exported ? `تم تصدير ${r.exported} طلب وإرساله للمستلِمين ✅` : 'لا توجد طلبات جديدة للتصدير (كلها مُصدَّرة أو لا يوجد).', r.exported ? 'success' : 'error');
      } catch (e) { toast(e.message, 'error'); }
      exportNow.disabled = false; exportNow.textContent = '📤 تصدير للمراجِع الآن (اختبار)';
    };
    c.appendChild(exportNow);

    // ===== بطاقة ربط أرقام المهندسين بحساباتهم =====
    const linkCard = el(`<div class="card" style="max-width:680px;margin-top:16px">
      <h3 style="margin:0 0 4px">ربط أرقام المهندسين</h3>
      <div class="hint" style="margin-bottom:12px">اربط رقم واتساب المهندس بحسابه ليصله تصريحه ورابط الدخول.</div>
      <div id="links-list" style="margin-bottom:14px"></div>
      <form id="link-form" class="row" style="gap:8px;align-items:flex-end">
        <div class="field" style="flex:1;margin:0"><label>المهندس</label>
          <select name="user_id">${apps.rows.map((u) => `<option value="${u.id}">${esc(u.full_name)} — ${esc(u.email)}</option>`).join('')}</select></div>
        <div class="field" style="flex:1;margin:0"><label>رقم الواتساب</label>
          <input name="wa_id" dir="ltr" style="text-align:left" placeholder="966551234567" /></div>
        <button class="btn" type="submit" style="white-space:nowrap">➕ ربط</button>
      </form></div>`);
    c.appendChild(linkCard);

    const listBox = linkCard.querySelector('#links-list');
    function renderLinks(rows) {
      listBox.innerHTML = rows.length
        ? rows.map((l) => `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;background:#1c2541;border-radius:8px;margin-bottom:6px">
            <span style="flex:1" dir="ltr">${esc(l.wa_id)} ← ${esc(l.full_name || '—')}${l.role && l.role !== 'applicant' ? ` (${esc(l.role)})` : ''}</span>
            <button class="btn sm danger" data-rm="${esc(l.wa_id)}">حذف</button></div>`).join('')
        : '<div class="hint">لا يوجد ربط بعد.</div>';
      listBox.querySelectorAll('[data-rm]').forEach((b) => b.onclick = async () => {
        if (!confirm('حذف هذا الربط؟')) return;
        try { await api('/wa/links/' + encodeURIComponent(b.dataset.rm), { method: 'DELETE' }); toast('حُذف الربط', 'success'); reloadLinks(); }
        catch (err) { toast(err.message, 'error'); }
      });
    }
    async function reloadLinks() { try { const r = await api('/wa/links'); renderLinks(r.rows); } catch {} }
    renderLinks(links.rows);

    linkCard.querySelector('#link-form').onsubmit = async (e) => {
      e.preventDefault();
      const f = e.target;
      const wa = f.wa_id.value.replace(/\D/g, '');
      if (!wa) { toast('أدخل رقم واتساب.', 'error'); return; }
      try {
        await api('/wa/links', { method: 'POST', body: { wa_id: wa, user_id: f.user_id.value, label: 'مهندس' } });
        toast('تم الربط ✅', 'success'); f.wa_id.value = ''; reloadLinks();
      } catch (err) { toast(err.message, 'error'); }
    };
  }

  // ---------- عارض قاعدة البيانات (دعم — للقراءة فقط) ----------
  async function viewDatabase() {
    $('#page-title').textContent = 'قاعدة البيانات';
    const c = $('#content'); c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    let t;
    try { t = await api('/wa/db/tables'); } catch (e) { c.innerHTML = `<div class="card">تعذّر: ${esc(e.message)}</div>`; return; }
    c.innerHTML = '';
    const bar = el(`<div class="card" style="margin-bottom:12px">
      <label style="display:block;margin-bottom:6px">اختر جدولاً:</label>
      <select id="tbl-sel">${t.tables.map((n) => `<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select>
    </div>`);
    c.appendChild(bar);
    const out = el('<div id="tbl-out"></div>'); c.appendChild(out);
    const SENSITIVE = ['password_hash', 'pw_enc', 'session_id', 'verify_token']; // تُخفى للأمان

    async function load(name) {
      out.innerHTML = '<div class="card">جارٍ…</div>';
      let d;
      try { d = await api('/wa/db/table/' + encodeURIComponent(name) + '?limit=200'); }
      catch (e) { out.innerHTML = `<div class="card">${esc(e.message)}</div>`; return; }
      const cell = (col, v) => {
        if (SENSITIVE.includes(col)) return '•••';
        if (v == null) return '';
        const s = String(v);
        return s.length > 120 ? esc(s.slice(0, 120)) + '…' : esc(s);
      };
      out.innerHTML = `<div class="card" style="overflow:auto">
        <div class="hint" style="margin-bottom:8px">${esc(name)} — إجمالي ${d.count} صفّ (عرض ${d.rows.length})</div>
        <table style="width:100%;border-collapse:collapse;font-size:.85em;white-space:nowrap">
          <thead><tr>${d.columns.map((col) => `<th style="text-align:right;border-bottom:1px solid #2a3550;padding:6px">${esc(col)}</th>`).join('')}</tr></thead>
          <tbody>${d.rows.map((r) => `<tr>${d.columns.map((col) => `<td style="border-bottom:1px solid #1c2541;padding:6px">${cell(col, r[col])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
    }
    bar.querySelector('#tbl-sel').onchange = (e) => load(e.target.value);
    if (t.tables.length) load(t.tables[0]);
  }

  // نموذج التجديد المبسّط — رقم الهوية فقط، وكل البيانات والمستندات تُجلب تلقائياً
  function viewRenewRequest(nid) {
    $('#page-title').textContent = 'تجديد تصريح';
    const c = $('#content'); c.innerHTML = '';
    const form = el(`
      <form class="card" id="req-form" style="max-width:560px">
        <h3>🔄 تجديد تصريح</h3>
        <p class="hint" style="margin-bottom:16px">أدخل رقم الهوية فقط — سيتم جلب كل بياناتك ومستنداتك السابقة تلقائياً.</p>
        <div class="field"><label>رقم الهوية / الإقامة</label>
          <input name="national_id" value="${esc(nid)}" readonly />
        </div>
        <div class="field"><div class="box-amber" style="padding:12px 14px;border-radius:10px;border:1px solid var(--border)" id="renew-preview">جارٍ جلب بياناتك…</div></div>
        <button class="btn block success" type="submit">تأكيد التجديد</button>
      </form>`);
    c.appendChild(form);

    api(`/requests/lookup/${encodeURIComponent(nid)}`).then((lk) => {
      const p = $('#renew-preview');
      if (lk.found && lk.data) {
        p.innerHTML = `سيُجدَّد التصريح للبيانات التالية:<br>
          • <b>صاحب التصريح:</b> ${esc(lk.data.beneficiary_name)}<br>
          • <b>نوع الوثيقة:</b> ${IDTYPE[lk.data.id_type] || 'هوية'}<br>
          • <b>الكفالة:</b> ${lk.data.sponsorship === 'other' ? 'شركة أخرى: ' + esc(lk.data.sponsor_company || '') : 'شركة ماب (MAB)'}<br>
          • <b>المستندات:</b> سيُعاد استخدام صورك ومستنداتك السابقة.`;
      } else { p.textContent = 'لا توجد بيانات سابقة لهذه الهوية.'; }
    }).catch(() => {});

    form.onsubmit = async (e) => {
      e.preventDefault();
      const sb = form.querySelector('button[type=submit]'); sb.disabled = true; sb.textContent = 'جارٍ التجديد…';
      try {
        const fd = new FormData(); fd.append('national_id', nid); fd.append('renewal', 'true');
        const r = await api('/requests', { method: 'POST', form: fd });
        toast('تم إرسال طلب التجديد: ' + r.request_number, 'success');
        route('my-requests');
      } catch (err) { toast(err.message, 'error'); sb.disabled = false; sb.textContent = 'تأكيد التجديد'; }
    };
  }

  // ============================================================
  //  صندوق الطلبات (المراجِع/الدعم)
  // ============================================================
  let selectedRequests = new Set();
  function updateReqSelInfo() {
    const info = $('#req-sel-info');
    if (info) info.textContent = selectedRequests.size ? `محدد: ${selectedRequests.size}` : 'لم يتم تحديد أي طلب (سيُصدَّر الكل حسب الفلتر)';
  }
  function kpiCards(d) {
    return `
      <div class="kpi"><div class="v">${d.totals.requests}</div><div class="l">إجمالي الطلبات</div><span class="badge s-active">الكل</span></div>
      <div class="kpi"><div class="v">${d.byStatus.new || 0}</div><div class="l">طلبات جديدة</div><span class="badge s-new">جديد</span></div>
      <div class="kpi"><div class="v">${d.totals.open}</div><div class="l">قيد المعالجة</div><span class="badge s-under_review">جارٍ</span></div>
      <div class="kpi"><div class="v">${d.totals.approvedToday}</div><div class="l">معتمدة اليوم</div><span class="badge s-approved">معتمد</span></div>`;
  }
  const INBOX_TABS = [['', 'الكل'], ['new', 'جديد'], ['under_review', 'قيد المراجعة'],
    ['info_required', 'بانتظار معلومات'], ['approved', 'معتمد'], ['rejected', 'مرفوض']];
  let inboxStatus = '';

  async function viewInbox() {
    $('#page-title').textContent = 'صندوق الطلبات';
    selectedRequests = new Set();
    inboxStatus = '';
    const canExport = user.role === 'reviewer' || user.role === 'support';
    if (canExport) {
      $('#page-actions').appendChild(btn('⬇ تصدير للجهة', () => exportRequests('authority')));
      $('#page-actions').appendChild(btn('⬇ تصدير كامل', () => exportRequests('full'), 'btn ghost'));
    }
    const c = $('#content');
    c.innerHTML = `
      <div id="inbox-kpis" class="kpis"></div>
      <div class="card">
        <div class="tabs-row" id="status-tabs">${INBOX_TABS.map(([k, l]) =>
          `<button class="tab${k === inboxStatus ? ' active' : ''}" data-k="${k}">${l}</button>`).join('')}</div>
        <div class="filters" style="margin-top:14px">
          <div class="field" style="flex:1 1 260px"><input id="f-q" placeholder="بحث برقم الطلب / الهوية / الاسم" /></div>
          <button class="btn" id="f-go">بحث</button>
          <button class="btn ghost" id="f-refresh" title="تحديث">⟳</button>
        </div>
        ${canExport ? '<div class="sel-bar"><span id="req-sel-info"></span></div>' : ''}
      </div>
      <div id="inbox-list"></div>`;

    let page = 1; const pageSize = 10;
    const load = async () => {
      const params = new URLSearchParams({ ...($('#f-q').value && { q: $('#f-q').value }), ...(inboxStatus && { status: inboxStatus }), page, pageSize });
      const { rows, total } = await api('/requests?' + params);
      const list = $('#inbox-list'); list.innerHTML = '';
      list.appendChild(requestsTable(rows, canExport));
      list.appendChild(paginationBar(total, page, pageSize, (p) => { page = p; load(); }));
      updateReqSelInfo();
      try { const d = await api('/reports/dashboard'); $('#inbox-kpis').innerHTML = kpiCards(d); } catch {}
    };
    const reset = () => { page = 1; load(); };
    activeLoad = load;
    $('#status-tabs').querySelectorAll('.tab').forEach((b) => b.onclick = () => {
      inboxStatus = b.dataset.k;
      $('#status-tabs').querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x.dataset.k === inboxStatus));
      reset();
    });
    $('#f-go').onclick = reset; $('#f-refresh').onclick = load; $('#f-q').onkeydown = (e) => e.key === 'Enter' && reset();
    load();
  }
  // شريط ترقيم الصفحات
  function paginationBar(total, page, pageSize, onPage) {
    const pages = Math.ceil((total || 0) / pageSize) || 1;
    const wrap = el('<div class="pager"></div>');
    if (pages <= 1) { wrap.appendChild(el(`<span class="pager-info">${total || 0} عنصر</span>`)); return wrap; }
    const mk = (label, p, disabled, active) => {
      const b = el(`<button class="btn sm ${active ? '' : 'ghost'}" ${disabled ? 'disabled' : ''}>${label}</button>`);
      if (!disabled && !active) b.onclick = () => onPage(p);
      return b;
    };
    wrap.appendChild(mk('« السابق', page - 1, page <= 1));
    for (let p = 1; p <= pages; p++) {
      if (pages > 7 && p > 1 && p < pages && Math.abs(p - page) > 1) { if (p === 2 || p === pages - 1) wrap.appendChild(el('<span class="pager-dots">…</span>')); continue; }
      wrap.appendChild(mk(String(p), p, false, p === page));
    }
    wrap.appendChild(mk('التالي »', page + 1, page >= pages));
    wrap.appendChild(el(`<span class="pager-info">صفحة ${page} من ${pages} · ${total} طلب</span>`));
    return wrap;
  }

  function requestsTable(rows, selectable) {
    if (!rows.length) return el('<div class="card empty">لا توجد طلبات.</div>');
    const head = `${selectable ? '<th style="width:36px"><input type="checkbox" id="req-sel-all" title="تحديد الكل"></th>' : ''}
      <th>رقم الطلب</th><th>النوع</th><th>الرقم</th><th>صاحب التصريح</th><th>الحالة</th><th>المرفقات</th><th>التقديم</th><th>الإجراء</th>`;
    const tbl = el(`<div class="card"><div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody></tbody></table></div></div>`);
    const tb = tbl.querySelector('tbody');
    for (const r of rows) {
      const cb = selectable ? `<td class="sel-cell"><input type="checkbox" class="req-sel-row" data-id="${r.id}" ${selectedRequests.has(r.id) ? 'checked' : ''}></td>` : '';
      const tr = el(`<tr>${cb}
        <td><b>${esc(r.request_number)}</b></td>
        <td>${IDTYPE[r.id_type] || 'هوية'}</td>
        <td>${esc(r.national_id)}</td>
        <td>${esc(r.beneficiary_name || r.applicant_name)}</td>
        <td>${badge(r.status)}</td>
        <td>${r.attachment_count ?? '—'}</td>
        <td style="font-size:12px;color:var(--muted)">${fmt(r.submitted_at)}</td>
        <td><button class="btn sm ghost">🔍 عرض</button></td></tr>`);
      tr.onclick = (e) => { if (e.target.closest('.sel-cell')) return; openRequest(r.id); };
      tb.appendChild(tr);
    }
    if (selectable) {
      tbl.querySelectorAll('.req-sel-row').forEach((c) => c.onchange = () => {
        c.checked ? selectedRequests.add(c.dataset.id) : selectedRequests.delete(c.dataset.id); updateReqSelInfo();
      });
      const all = tbl.querySelector('#req-sel-all');
      all.onchange = () => {
        tbl.querySelectorAll('.req-sel-row').forEach((c) => { c.checked = all.checked; c.checked ? selectedRequests.add(c.dataset.id) : selectedRequests.delete(c.dataset.id); });
        updateReqSelInfo();
      };
    }
    return tbl;
  }
  function exportRequests(mode) {
    const base = { ...(mode === 'full' && { mode: 'full' }) };
    if (selectedRequests.size) {
      const p = new URLSearchParams({ ...base, ids: [...selectedRequests].join(',') });
      window.location.href = '/api/requests/export.xlsx?' + p; return;
    }
    const q = $('#f-q')?.value, status = $('#f-status')?.value;
    const params = new URLSearchParams({ ...base, ...(q && { q }), ...(status && { status }) });
    window.location.href = '/api/requests/export.xlsx?' + params;
  }

  // ============================================================
  //  تفاصيل الطلب + المعاينة + الإجراءات
  // ============================================================
  async function openRequest(id) {
    // مزامنة الهوية الفعلية (الكوكي) لتفادي تعارض الجلسات بين التبويبات
    try { const { user: u } = await api('/auth/me'); if (u && u.id !== user.id) { user = u; $('#user-name').textContent = u.full_name; $('#user-role').textContent = ROLE[u.role] || u.role; } } catch {}
    const { request: r, attachments, history, permit } = await api('/requests/' + id);
    const isReviewer = user.role === 'reviewer';
    const isOwner = r.created_by === user.id;

    const chips = attachments.map((a, i) =>
      `<button type="button" class="attach-chip${i === 0 ? ' active' : ''}" data-att="${a.id}" data-mime="${a.mime_type}">
        ${FILETYPE[a.file_type] || '📎'}</button>`).join('');

    let actions = '';
    if (isReviewer && ['new', 'under_review', 'info_required'].includes(r.status)) {
      if (r.status === 'new') actions += `<button class="btn" onclick="App.act('${id}','start-review')">بدء المراجعة</button>`;
      actions += `<button class="btn success" onclick="App.approveIssue('${id}','${esc(r.beneficiary_name || r.applicant_name)}')">✅ اعتماد وإصدار التصريح</button>`;
      actions += `<button class="btn warning" onclick="App.act('${id}','request-info')">طلب معلومات</button>`;
      actions += `<button class="btn danger" onclick="App.act('${id}','reject')">رفض</button>`;
      if (['under_review', 'info_required'].includes(r.status))
        actions += `<button class="btn ghost" onclick="App.act('${id}','release')">ترك</button>`;
    }

    let respondHtml = '';
    if (isOwner && r.status === 'info_required') {
      respondHtml = `<div class="card box-amber">
        <h3>مطلوب منك معلومات إضافية</h3>
        ${r.decision_reason ? `<p style="margin-bottom:12px"><b>المطلوب:</b> ${esc(r.decision_reason)}</p>` : ''}
        <form id="respond-form">
          <div class="field"><label>ردّك / المعلومات المطلوبة</label><textarea name="response" placeholder="اكتب ردّك هنا…"></textarea></div>
          <div class="field"><label>إرفاق ملفات (اختياري)</label><input type="file" name="documents" accept="image/*,application/pdf" multiple /></div>
          <button class="btn block" type="submit">إرسال الرد وإعادة الطلب للمراجعة</button>
        </form></div>`;
    }

    let permitHtml = '';
    if (permit) {
      permitHtml = `<div class="card box-green">
        <h3>التصريح الصادر</h3>
        <div class="detail-grid">
          <div><div class="k">الرقم</div><div class="vv">${esc(permit.permit_number)}</div></div>
          <div><div class="k">الحالة</div><div class="vv">${badge(permit.status)}</div></div>
          <div><div class="k">من</div><div class="vv">${fmtDate(permit.valid_from)}</div></div>
          <div><div class="k">حتى</div><div class="vv">${fmtDate(permit.valid_to)}</div></div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <a class="btn sm" href="/api/permits/${permit.id}/document" target="_blank">عرض ملف التصريح</a>
          <a class="btn sm ghost" href="/api/permits/${permit.id}/document?download=1">⬇ تحميل</a>
          ${isReviewer && permit.status === 'active' ? `<button class="btn danger sm" onclick="App.cancelPermit('${permit.id}','${id}')">إلغاء التصريح</button>` : ''}
        </div></div>`;
    }

    const histHtml = history.map((h) =>
      `<div class="item"><div>${h.from_status ? badge(h.from_status) + ' ← ' : ''}${badge(h.to_status)}
        ${h.reason ? `<div style="font-size:13px;margin-top:4px">${esc(h.reason)}</div>` : ''}</div>
       <div class="when">${esc(h.changed_by_name || 'النظام')} — ${fmt(h.changed_at)}</div></div>`).join('');

    showModal(`الطلب ${esc(r.request_number)}`, `
      <div class="detail-grid">
        <div><div class="k">الحالة</div><div class="vv">${badge(r.status)}</div></div>
        <div><div class="k">نوع الوثيقة</div><div class="vv">${IDTYPE[r.id_type] || 'هوية'}</div></div>
        <div><div class="k">الرقم</div><div class="vv">${esc(r.national_id)}</div></div>
        <div><div class="k">صاحب التصريح</div><div class="vv">${esc(r.beneficiary_name || '—')}</div></div>
        <div><div class="k">مقدّم الطلب</div><div class="vv">${esc(r.applicant_name)}</div></div>
        <div><div class="k">الكفالة</div><div class="vv">${r.sponsorship === 'other' ? 'شركة أخرى: ' + esc(r.sponsor_company || '') : 'شركة ماب (MAB)'}</div></div>
        <div><div class="k">تاريخ التقديم</div><div class="vv">${fmt(r.submitted_at)}</div></div>
        <div><div class="k">المراجِع</div><div class="vv">${esc(r.assigned_name || '—')}</div></div>
      </div>
      <div class="field"><div class="k">الغرض</div><div class="vv">${esc(r.purpose)}</div></div>
      <h3 style="margin:18px 0 10px">المرفقات</h3>
      <div class="attach-list">${chips || '<span style="color:#5b7186">لا مرفقات</span>'}</div>
      ${attachments.length ? `<div class="preview-bar"><a id="att-download" class="btn sm" download>⬇ تحميل الملف</a>
        <a id="att-open" class="btn sm ghost" target="_blank">فتح في نافذة جديدة</a></div>` : ''}
      <div class="preview-pane" id="att-preview"><div class="preview-empty">اختر مرفقاً لمعاينته هنا</div></div>
      ${permitHtml}
      ${respondHtml}
      ${actions ? `<h3 style="margin:18px 0 10px">الإجراءات</h3><div style="display:flex;gap:8px;flex-wrap:wrap">${actions}</div>` : ''}
      <h3 style="margin:18px 0 10px">سجل الحالة</h3><div class="timeline">${histHtml}</div>
    `);

    const previewPane = $('#att-preview');
    const showPreview = (attId, mime) => {
      const url = `/api/requests/${id}/attachments/${attId}`;
      previewPane.innerHTML = mime.startsWith('image/') ? `<img src="${url}" alt="معاينة" />`
        : mime === 'application/pdf' ? `<iframe src="${url}" title="معاينة"></iframe>`
        : `<div class="preview-empty"><a href="${url}" target="_blank">فتح الملف</a></div>`;
      const dl = $('#att-download'), op = $('#att-open');
      if (dl) dl.href = url + '?download=1';
      if (op) op.href = url;
    };
    document.querySelectorAll('.attach-chip').forEach((b) => {
      b.onclick = () => {
        document.querySelectorAll('.attach-chip').forEach((x) => x.classList.remove('active'));
        b.classList.add('active'); showPreview(b.dataset.att, b.dataset.mime);
      };
    });
    if (attachments.length) showPreview(attachments[0].id, attachments[0].mime_type);

    const rf = $('#respond-form');
    if (rf) rf.onsubmit = async (e) => {
      e.preventDefault();
      try { await api(`/requests/${id}/respond`, { method: 'POST', form: new FormData(rf) });
        toast('تم إرسال الرد', 'success'); closeModal(); refreshCurrent(); }
      catch (err) { toast(err.message, 'error'); }
    };
  }

  // طلب معلومات على شكل خيارات (صناديق اختيار)
  function requestInfoModal(id) {
    const opts = ['صورة الهوية من أبشر', 'صورة الإقامة من أبشر', 'تقرير مقيم', 'صورة شخصية'];
    showModal('طلب معلومات إضافية', `
      <p class="hint" style="margin-bottom:12px">حدّد ما هو المطلوب من مقدّم الطلب:</p>
      <label class="ri-chip ri-all-chip"><input type="checkbox" id="ri-all"> تحديد الكل</label>
      <div class="ri-list">
        ${opts.map((o) => `<label class="ri-chip ri-opt"><input type="checkbox" value="${esc(o)}"> ${o}</label>`).join('')}
      </div>
      <div class="field" style="margin-top:14px"><label>ملاحظة إضافية (اختياري)</label>
        <textarea id="ri-extra" placeholder="أي تفاصيل أخرى…"></textarea></div>
      <div style="display:flex;gap:8px">
        <button class="btn block warning" id="ri-send">إرسال الطلب</button>
        <button class="btn ghost" id="ri-cancel">إلغاء</button></div>`);
    const boxes = [...document.querySelectorAll('.ri-opt input')];
    $('#ri-all').onchange = (e) => boxes.forEach((b) => { b.checked = e.target.checked; });
    $('#ri-cancel').onclick = () => { closeModal(); openRequest(id); };
    $('#ri-send').onclick = async () => {
      const selected = boxes.filter((b) => b.checked).map((b) => b.value);
      const extra = $('#ri-extra').value.trim();
      const parts = [...selected]; if (extra) parts.push(extra);
      if (!parts.length) { toast('اختر عنصراً واحداً على الأقل أو اكتب ملاحظة.', 'error'); return; }
      try {
        await api(`/requests/${id}/request-info`, { method: 'POST', body: { reason: 'المطلوب: ' + parts.join('، ') } });
        toast('تم إرسال طلب المعلومات', 'success'); closeModal(); openRequest(id);
      } catch (err) { toast(err.message, 'error'); }
    };
  }

  async function act(id, action) {
    let body = {};
    if (action === 'request-info') { requestInfoModal(id); return; }
    if (action === 'reject') {
      const r = await promptModal('رفض الطلب', { label: 'سبب الرفض', textarea: true });
      if (!r) { openRequest(id); return; } body.reason = r;
    }
    if (action === 'release') {
      const ok = await confirmModal('ترك الطلب', 'هل تريد ترك الطلب وإعادته للطابور؟');
      if (!ok) { openRequest(id); return; }
    }
    try { await api(`/requests/${id}/${action}`, { method: 'POST', body });
      toast('تم تنفيذ الإجراء', 'success'); closeModal(); openRequest(id); }
    catch (err) { toast(err.message, 'error'); openRequest(id); }
  }

  function approveIssue(requestId, holder) {
    const today = new Date().toISOString().slice(0, 10);
    showModal('اعتماد وإصدار التصريح', `<form id="issue-form">
        <p style="margin-bottom:14px">إصدار تصريح لـ <b>${esc(holder)}</b> واعتماد الطلب.</p>
        <div class="row">
          <div class="field"><label>تاريخ بداية التصريح</label><input type="date" name="valid_from" lang="en-GB" value="${today}" required /></div>
          <div class="field"><label>تاريخ نهاية التصريح</label><input type="date" name="valid_to" lang="en-GB" required /></div>
        </div>
        <div class="field"><label>ملف التصريح الرسمي من الجهة المعنية * (صورة أو PDF) <span class="note-red">إلزامي</span></label>
          <input type="file" name="permit_file" accept="image/*,application/pdf" required /></div>
        <button class="btn block success" type="submit">اعتماد وإصدار</button></form>`);
    $('#issue-form').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      const sb = f.querySelector('button[type=submit]'); sb.disabled = true; sb.textContent = 'جارٍ التنفيذ…';
      try { const r = await api(`/requests/${requestId}/approve-issue`, { method: 'POST', form: new FormData(f) });
        toast('تم الاعتماد وإصدار التصريح: ' + r.permit_number, 'success'); closeModal(); openRequest(requestId);
      } catch (err) { toast(err.message, 'error'); sb.disabled = false; sb.textContent = 'اعتماد وإصدار'; }
    };
  }
  async function cancelPermit(permitId, requestId) {
    const reason = await promptModal('إلغاء التصريح', { label: 'سبب الإلغاء', textarea: true });
    if (!reason) { if (requestId) openRequest(requestId); return; }
    try { await api(`/permits/${permitId}/cancel`, { method: 'POST', body: { reason } });
      toast('تم الإلغاء', 'success'); closeModal();
      if (requestId) openRequest(requestId); else if (activeLoad) activeLoad(); }
    catch (err) { toast(err.message, 'error'); }
  }

  async function deletePermit(permitId, permitNumber, nationalId) {
    const ok = await confirmModal('حذف تصريح نهائياً',
      `سيُحذف التصريح «${permitNumber}» (هوية ${nationalId}) نهائياً من قاعدة البيانات مع ملفه المرفق، ولا يمكن التراجع. بعد الحذف يمكنك إضافة تصريح/طلب جديد بنفس رقم الهوية.`,
      { danger: true });
    if (!ok) return;
    try {
      await api(`/permits/${permitId}`, { method: 'DELETE' });
      toast('تم حذف التصريح نهائياً.', 'success');
      closeModal();
      if (activeLoad) activeLoad();
    } catch (err) { toast(err.message, 'error'); }
  }

  // عرض التصريح (الملف الرسمي) عند الضغط على صفّه
  async function openPermit(id) {
    const { permit } = await api('/permits/' + id);
    const isReviewer = user.role === 'reviewer';
    const canDelete = user.role === 'reviewer' || user.role === 'support';
    const docUrl = `/api/permits/${id}/document`;
    showModal(`التصريح ${esc(permit.permit_number)}`, `
      <div class="detail-grid">
        <div><div class="k">رقم التصريح</div><div class="vv">${esc(permit.permit_number)}</div></div>
        <div><div class="k">صاحب التصريح</div><div class="vv">${esc(permit.holder_name)}</div></div>
        <div><div class="k">الهوية/الإقامة</div><div class="vv">${esc(permit.national_id)}</div></div>
        <div><div class="k">الحالة</div><div class="vv">${badge(permit.status)}</div></div>
        <div><div class="k">صالح من</div><div class="vv">${fmtDate(permit.valid_from)}</div></div>
        <div><div class="k">صالح حتى</div><div class="vv">${fmtDate(permit.valid_to)}</div></div>
      </div>
      <div class="preview-bar">
        <a class="btn sm" href="${docUrl}" target="_blank">📄 فتح في نافذة</a>
        <a class="btn sm ghost" href="${docUrl}?download=1">⬇ تحميل التصريح</a>
        ${isReviewer && permit.status === 'active' ? `<button class="btn danger sm" onclick="App.cancelPermit('${id}')">إلغاء التصريح</button>` : ''}
        ${canDelete ? `<button class="btn danger sm" onclick="App.deletePermit('${id}','${esc(permit.permit_number)}','${esc(permit.national_id)}')">🗑 حذف نهائي</button>` : ''}
      </div>
      <div class="preview-pane"><iframe src="${docUrl}" title="ملف التصريح"></iframe></div>
    `);
  }

  // ============================================================
  //  التصاريح (المراجِع/الدعم) + تصاريحي (المقدّم)
  // ============================================================
  let selectedPermits = new Set();

  function updateSelInfo() {
    const info = $('#sel-info'); if (info) info.textContent = selectedPermits.size ? `محدد: ${selectedPermits.size}` : 'لم يتم تحديد أي تصريح (سيُصدَّر الكل حسب الفلتر)';
  }
  // حالة الانتهاء + الأيام المتبقية
  function expiryInfo(p) {
    if (p.status === 'cancelled') return '<div class="exp-note s-cancelled">ملغي</div>';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(p.valid_to + 'T00:00:00');
    const days = Math.ceil((end - today) / 86400000);
    if (p.status === 'expired' || days < 0) return '<div class="exp-note danger">منتهٍ</div>';
    if (days === 0) return '<div class="exp-note danger">ينتهي اليوم</div>';
    const cls = days <= 5 ? 'danger' : days <= 15 ? 'warn' : 'ok';
    return `<div class="exp-note ${cls}">باقي ${days} يوم</div>`;
  }
  // زر التجديد يظهر فقط داخل نافذة التجديد (الأيام المحدّدة من الإعدادات) قبل الانتهاء
  function canRenewPermit(p) {
    if (user.role !== 'applicant' || p.status !== 'active' || !p.valid_to) return false;
    const daysLeft = Math.ceil((new Date(p.valid_to + 'T00:00:00Z') - new Date()) / 86400000);
    return daysLeft <= (user.renewalWindowDays || 5);
  }
  function permitsTable(rows, selectable) {
    if (!rows.length) return el('<div class="card empty">لا توجد تصاريح.</div>');
    const head = `${selectable ? '<th style="width:36px"><input type="checkbox" id="sel-all" title="تحديد الكل"></th>' : ''}
      <th>رقم التصريح</th><th>صاحبه</th><th>الهوية/الإقامة</th><th>الحالة</th><th>من</th><th>حتى</th><th></th>`;
    const tbl = el(`<div class="card"><div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody></tbody></table></div></div>`);
    const tb = tbl.querySelector('tbody');
    rows.forEach((p) => {
      const cb = selectable ? `<td class="sel-cell"><input type="checkbox" class="sel-row" data-id="${p.id}" ${selectedPermits.has(p.id) ? 'checked' : ''}></td>` : '';
      const tr = el(`<tr>${cb}
        <td><b>${esc(p.permit_number)}</b></td><td>${esc(p.holder_name)}</td><td>${esc(p.national_id)}</td>
        <td>${badge(p.status)}</td><td>${fmtDate(p.valid_from)}</td>
        <td>${fmtDate(p.valid_to)}${expiryInfo(p)}</td>
        <td class="row-actions"><a class="btn sm ghost" href="/api/permits/${p.id}/document" target="_blank" onclick="event.stopPropagation()">وثيقة</a>${canRenewPermit(p) ? `<button class="btn sm success" onclick="event.stopPropagation();App.renewPermit('${esc(p.national_id)}')">🔄 تجديد</button>` : ''}${(user.role === 'reviewer' || user.role === 'support') ? `<button class="btn sm danger" onclick="event.stopPropagation();App.deletePermit('${p.id}','${esc(p.permit_number)}','${esc(p.national_id)}')">حذف</button>` : ''}</td></tr>`);
      tr.onclick = (e) => { if (e.target.closest('.sel-cell') || e.target.closest('a')) return; openPermit(p.id); };
      tb.appendChild(tr);
    });
    if (selectable) {
      tbl.querySelectorAll('.sel-row').forEach((c) => c.onchange = () => {
        c.checked ? selectedPermits.add(c.dataset.id) : selectedPermits.delete(c.dataset.id);
        updateSelInfo();
      });
      const all = tbl.querySelector('#sel-all');
      all.onchange = () => {
        tbl.querySelectorAll('.sel-row').forEach((c) => { c.checked = all.checked; c.checked ? selectedPermits.add(c.dataset.id) : selectedPermits.delete(c.dataset.id); });
        updateSelInfo();
      };
    }
    return tbl;
  }
  async function permitsView(title) {
    $('#page-title').textContent = title;
    selectedPermits = new Set();
    const canExport = user.role === 'reviewer' || user.role === 'support';
    if (canExport) $('#page-actions').appendChild(btn('⬇ تصدير Excel', exportPermits));
    const c = $('#content');
    c.innerHTML = `<div class="card"><div class="filters">
      <div class="field"><label>بحث برقم الهوية / الإقامة / التصريح</label><input id="pf-q" placeholder="ابحث…" /></div>
      <div class="field"><label>الحالة</label><select id="pf-status">
        <option value="">الكل</option><option value="active">فعّال</option><option value="expired">منتهٍ</option><option value="cancelled">ملغي</option>
      </select></div>
      <div class="field"><label>الترتيب</label><select id="pf-sort">
        <option value="recent">الأحدث إصداراً</option><option value="expiry">الأقرب انتهاءً</option>
      </select></div>
      <button class="btn" id="pf-go">تطبيق</button></div>
      <label class="radio" style="margin-top:12px"><input type="checkbox" id="pf-dedupe" checked> عرض آخر تصريح فقط لكل هوية</label>
      ${canExport ? '<div class="sel-bar"><span id="sel-info"></span></div>' : ''}</div><div id="permits-list"></div>`;
    const load = async () => {
      const params = new URLSearchParams({
        ...($('#pf-q').value && { q: $('#pf-q').value }),
        ...($('#pf-status').value && { status: $('#pf-status').value }),
        sort: $('#pf-sort').value,
        ...($('#pf-dedupe').checked && { dedupe: '1' }),
      });
      const { rows } = await api('/permits?' + params);
      const list = $('#permits-list'); list.innerHTML = ''; list.appendChild(permitsTable(rows, canExport));
      updateSelInfo();
    };
    activeLoad = load;
    $('#pf-go').onclick = load; $('#pf-sort').onchange = load; $('#pf-dedupe').onchange = load;
    $('#pf-q').onkeydown = (e) => e.key === 'Enter' && load(); load();
  }
  function exportPermits() {
    if (selectedPermits.size) {
      window.location.href = '/api/permits/export.xlsx?ids=' + encodeURIComponent([...selectedPermits].join(','));
      return;
    }
    const q = $('#pf-q')?.value, status = $('#pf-status')?.value;
    const params = new URLSearchParams({ ...(q && { q }), ...(status && { status }) });
    window.location.href = '/api/permits/export.xlsx?' + params;
  }
  const viewPermits = () => permitsView('التصاريح');
  const viewMyPermits = () => permitsView('تصاريحي');

  function metric(label, value, hint = '') {
    return `<div class="metric-card"><div class="metric-label">${esc(label)}</div><div class="metric-value">${esc(value)}</div><div class="metric-hint">${esc(hint)}</div></div>`;
  }
  function barChart(rows, cls = '') {
    const max = Math.max(1, ...rows.map((r) => r.c || 0));
    return `<div class="v2-bars ${cls}">${rows.length ? rows.map((r) => `
      <div class="v2-bar" title="${esc(r.label)}: ${r.c}">
        <span style="height:${Math.max(8, Math.round((r.c || 0) / max * 120))}px"></span>
        <b>${r.c || 0}</b><small>${esc(String(r.label).slice(-8))}</small>
      </div>`).join('') : '<div class="empty">لا بيانات</div>'}</div>`;
  }
  function donut(status) {
    const total = Object.values(status).reduce((a, b) => a + Number(b || 0), 0) || 1;
    const approved = Math.round(((status.approved || 0) / total) * 100);
    return `<div class="donut" style="--p:${approved}"><span>${approved}%</span></div>`;
  }
  function destinationMap(rows = []) {
    const total = rows.reduce((a, r) => a + Number(r.c || 0), 0) || 1;
    const top = rows.slice(0, 5);
    return `<div class="destination-map">
      ${top.length ? top.map((r, i) => {
        const pct = Math.round((Number(r.c || 0) / total) * 100);
        return `<div class="destination-step ${i === 0 ? 'top' : ''}">
          <div class="destination-rank">${i + 1}</div>
          <div class="destination-body">
            <b>${esc(r.label)}</b><span>${r.c || 0} تصريح / طلب</span>
            <div class="destination-track"><i style="width:${Math.max(8, pct)}%"></i></div>
          </div>
          <strong>${pct}%</strong>
        </div>`;
      }).join('') : '<div class="empty">لا توجد مواقع بعد</div>'}
    </div>`;
  }
  function statusFlow(status = {}) {
    const ordered = ['new', 'under_review', 'info_required', 'approved', 'rejected'];
    return `<div class="status-flow">${ordered.map((k) => `<div>
      <span>${STATUS[k]}</span><b>${status[k] || 0}</b>
    </div>`).join('')}</div>`;
  }

  async function viewManagement() {
    $('#page-title').textContent = 'الإدارة العامة';
    $('#page-actions').innerHTML = '<button class="btn ghost" onclick="window.location.href=\'/api/requests/export.xlsx?mode=full\'">تصدير Excel</button>';
    const c = $('#content'); c.innerHTML = '<div class="skeleton-grid"><div></div><div></div><div></div></div>';
    const render = async () => {
      const d = await api('/reports/enterprise');
      c.innerHTML = `<section class="v2-hero">
        <div><span class="eyebrow">MAB Enterprise V2</span><h2>لوحة تحكم لحظية للتصاريح والعمليات</h2><p>آخر تحديث: ${fmt(d.refreshedAt)}</p></div>
        <div class="live-pill"><span></span> Realtime Dashboard</div>
      </section>
      <div class="metric-grid">
        ${metric('إجمالي الطلبات', d.totals.requests, 'كل الفترات')}
        ${metric('طلبات اليوم', d.totals.today, 'نافذة اليوم')}
        ${metric('طلبات الأسبوع', d.totals.week, 'آخر 7 أيام')}
        ${metric('طلبات الشهر', d.totals.month, 'الشهر الحالي')}
        ${metric('طلبات السنة', d.totals.year, 'السنة الحالية')}
        ${metric('التصاريح الصادرة', d.totals.issued, 'كل التصاريح')}
        ${metric('المرفوضة', d.totals.rejected, 'قرارات الرفض')}
        ${metric('المعلقة', d.totals.pending, 'تحتاج متابعة')}
        ${metric('متوسط الإصدار', d.averages.issueHours + 'س', 'من الطلب حتى التصريح')}
        ${metric('متوسط المراجعة', d.averages.reviewHours + 'س', 'حتى القرار')}
      </div>
      <div class="v2-grid two">
        <div class="card chart-card"><h3>أكثر المواقع التي ذهبت لها التصاريح</h3>${destinationMap(d.charts.byRegion)}</div>
        <div class="card chart-card"><h3>سير الحالات المختصر</h3>${statusFlow(d.byStatus)}</div>
      </div>
      <div class="v2-grid three">
        <div class="card chart-card"><h3>عدد الطلبات لكل يوم</h3>${barChart(d.charts.byDay)}</div>
        <div class="card chart-card"><h3>طلبات لكل ساعة</h3>${barChart(d.charts.byHour, 'compact')}</div>
        <div class="card chart-card"><h3>حسب الشركة</h3>${barChart(d.charts.byCompany)}</div>
      </div>
      <div class="leader-grid">
        ${metric('أكثر مهندس رفع طلبات', d.leaders.topEngineer.label, `${d.leaders.topEngineer.c} طلب`)}
        ${metric('أكثر مستخدم نشاطاً', d.leaders.mostActiveUser.label, `${d.leaders.mostActiveUser.c} إجراء`)}
        ${metric('أكثر منطقة', d.leaders.topRegion.label, `${d.leaders.topRegion.c} طلب`)}
        ${metric('أكثر شركة', d.leaders.topCompany.label, `${d.leaders.topCompany.c} طلب`)}
        ${metric('أفضل أسبوع', d.leaders.bestWeek.label, `${d.leaders.bestWeek.c} طلب`)}
        ${metric('أفضل شهر', d.leaders.bestMonth.label, `${d.leaders.bestMonth.c} طلب`)}
      </div>`;
    };
    activeLoad = render;
    render();
  }

  async function viewSupervisor() {
    $('#page-title').textContent = 'لوحة المشرف';
    const c = $('#content'); c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    const { rows } = await api('/users/performance');
    const canManage = user.role === 'support';
    c.innerHTML = `<div class="metric-grid">
      ${metric('كل مقدمي الطلبات', rows.length, 'حسابات فعّالة وغير فعّالة')}
      ${metric('نشطون', rows.filter((r) => r.is_active).length, 'حسابات مفعّلة')}
      ${metric('طلبات اليوم', rows.reduce((a, r) => a + (r.daily_requests || 0), 0), 'لكل المستخدمين')}
      ${metric('طلبات الشهر', rows.reduce((a, r) => a + (r.monthly_requests || 0), 0), 'الشهر الحالي')}
    </div>
    <div class="card"><h3>متابعة مقدمي الطلبات</h3><div class="table-wrap"><table><thead><tr>
      <th>المستخدم</th><th>كل الطلبات</th><th>اليوم</th><th>الشهر</th><th>آخر دخول</th><th>آخر نشاط</th><th>الحالة</th><th>إجراءات</th>
      </tr></thead><tbody>${rows.map((u) => `<tr>
        <td><b>${esc(u.full_name)}</b><div class="hint">${esc(u.email)}</div></td>
        <td>${u.total_requests || 0}</td><td>${u.daily_requests || 0}</td><td>${u.monthly_requests || 0}</td>
        <td>${fmt(u.last_login_at)}</td><td>${fmt(u.last_activity_at || u.last_request_at)}</td>
        <td>${u.is_active ? '<span class="badge s-active">نشط</span>' : '<span class="badge s-rejected">موقوف</span>'}</td>
        <td>${canManage ? `<button class="btn sm ghost" onclick="App.toggleUser('${u.id}')">${u.is_active ? 'إيقاف' : 'تفعيل'}</button>
          <button class="btn sm ghost" onclick="App.passwordModal('${u.id}','${esc(u.full_name)}')">كلمة المرور</button>` : '<span class="hint">متابعة فقط</span>'}</td>
      </tr>`).join('')}</tbody></table></div></div>`;
  }

  function viewWorkflow() {
    $('#page-title').textContent = 'مخطط سير العمل';
    const steps = [
      ['التعهد', 'مقدم الطلب يوقع التعهد مرة واحدة قبل الدخول للنظام.'],
      ['تقديم الطلب', 'إدخال بيانات الشخص ورفع المرفقات خلال نافذة 8 صباحاً حتى 1 ظهراً.'],
      ['فرز المراجعة', 'ينتقل الطلب لصندوق المراجعين مع التحقق من البيانات والمرفقات.'],
      ['قرار المراجع', 'اعتماد أو رفض أو طلب معلومات إضافية حسب نتيجة الفحص.'],
      ['إصدار التصريح', 'بعد الاعتماد يتم رفع ملف التصريح وربطه بالطلب.'],
      ['متابعة الصلاحية', 'تظهر التصاريح للمستخدم وتدخل في تنبيهات التجديد قبل الانتهاء.'],
    ];
    $('#content').innerHTML = `<div class="workflow-lane">${steps.map((s, i) => `
      <button class="flow-node" data-i="${i}"><span>${i + 1}</span><b>${s[0]}</b><small>${s[1]}</small></button>`).join('')}</div>
      <div class="card flow-detail" id="flow-detail"><h3>${steps[0][0]}</h3><p>${steps[0][1]}</p></div>`;
    document.querySelectorAll('.flow-node').forEach((b) => b.onclick = () => {
      document.querySelectorAll('.flow-node').forEach((x) => x.classList.remove('active'));
      b.classList.add('active');
      const s = steps[b.dataset.i];
      $('#flow-detail').innerHTML = `<h3>${s[0]}</h3><p>${s[1]}</p>`;
    });
    document.querySelector('.flow-node')?.classList.add('active');
  }

  async function viewSystemHealth() {
    $('#page-title').textContent = 'صحة النظام';
    const h = await api('/reports/system-health');
    $('#content').innerHTML = `<div class="health-grid">
      ${Object.entries(h).map(([k, v]) => `<div class="health-card ${v.status}">
        <span></span><h3>${esc(k)}</h3><b>${esc(v.status)}</b><p>${esc(v.checkedAt || JSON.stringify(v.jobs || v).slice(0, 90))}</p>
      </div>`).join('')}</div>`;
  }

  async function viewPermissions() {
    $('#page-title').textContent = 'إدارة الصلاحيات';
    const c = $('#content'); c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    const [{ rows: users }, { rows: perms }] = await Promise.all([api('/users'), api('/users/permissions/catalog')]);
    c.innerHTML = `<div class="permission-layout">
      <div class="card"><h3>المستخدمون</h3><div class="perm-users">${users.map((u) => `<button data-id="${u.id}" data-name="${esc(u.full_name)}">${esc(u.full_name)}<small>${esc(u.role_name)}</small></button>`).join('')}</div></div>
      <form class="card" id="perm-form"><h3>Permission Matrix</h3><div id="perm-target" class="hint">اختر مستخدماً.</div>
        <div class="perm-grid">${perms.map((p) => `<label><input type="checkbox" name="perm" value="${p.code}" /> <span>${esc(p.name_ar)}</span><small>${esc(p.category)}</small></label>`).join('')}</div>
        <button class="btn block" type="submit">حفظ الصلاحيات المستقلة</button></form></div>`;
    let selected = null;
    async function loadUser(id, name) {
      selected = id; $('#perm-target').textContent = name;
      const r = await api(`/users/${id}/permissions`);
      document.querySelectorAll('input[name=perm]').forEach((x) => { x.checked = r.effective.includes(x.value); });
    }
    document.querySelectorAll('.perm-users button').forEach((b) => b.onclick = () => loadUser(b.dataset.id, b.dataset.name));
    $('#perm-form').onsubmit = async (e) => {
      e.preventDefault();
      if (!selected) return toast('اختر مستخدماً أولاً.', 'error');
      const permissions = [...document.querySelectorAll('input[name=perm]:checked')].map((x) => x.value);
      await api(`/users/${selected}/permissions`, { method: 'PUT', body: { permissions } });
      toast('تم حفظ الصلاحيات', 'success');
    };
  }

  // ============================================================
  //  لوحة التحكم
  // ============================================================
  async function viewDashboard() {
    $('#page-title').textContent = 'لوحة التحكم';
    const c = $('#content'); c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    const d = await api('/reports/dashboard');
    const maxT = Math.max(1, ...d.trend.map((t) => t.c));
    c.innerHTML = `
      <div class="kpis">
        <div class="kpi"><div class="v">${d.totals.requests}</div><div class="l">إجمالي الطلبات</div></div>
        <div class="kpi"><div class="v">${d.totals.open}</div><div class="l">قيد المعالجة</div></div>
        <div class="kpi"><div class="v">${d.totals.approvedToday}</div><div class="l">معتمدة اليوم</div></div>
        <div class="kpi"><div class="v">${d.totals.activePermits}</div><div class="l">تصاريح فعّالة</div></div>
        <div class="kpi"><div class="v" style="color:#d97706">${d.totals.expiringSoon}</div><div class="l">تنتهي خلال 7 أيام</div></div>
        <div class="kpi"><div class="v">${d.avgProcessingHours}س</div><div class="l">متوسط زمن المعالجة</div></div>
      </div>
      <div class="card"><h3>الطلبات حسب الحالة</h3><div class="statwrap">
        ${Object.entries(STATUS).filter(([k]) => k !== 'active').map(([k]) =>
          `<div class="statbox"><div class="n">${d.byStatus[k] || 0}</div>${badge(k)}</div>`).join('')}
      </div></div>
      <div class="card"><h3>اتجاه الطلبات (آخر 14 يوماً)</h3>
        <div class="bars">${d.trend.length ? d.trend.map((t) => `
          <div class="bar-col" title="${t.d}: ${t.c}">
            <div class="bar-val">${t.c}</div>
            <div class="bar" style="height:${Math.max(6, Math.round(t.c / maxT * 150))}px"></div>
            <div class="bar-x">${t.d.slice(5)}</div>
          </div>`).join('') : '<div class="empty">لا بيانات بعد</div>'}</div>
      </div>`;
  }

  async function viewOfficers() {
    $('#page-title').textContent = 'أداء المراجِعين';
    const { rows } = await api('/reports/officers');
    const c = $('#content');
    if (!rows.length) { c.innerHTML = '<div class="card empty">لا بيانات.</div>'; return; }
    c.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr><th>المراجِع</th><th>معتمد</th><th>مرفوض</th><th>إجمالي الإجراءات</th></tr></thead>
      <tbody>${rows.map((r) => `<tr><td>${esc(r.full_name)}</td><td>${r.approved}</td><td>${r.rejected}</td><td>${r.total}</td></tr>`).join('')}</tbody></table></div></div>`;
  }

  // ============================================================
  //  المستخدمون
  // ============================================================
  async function viewUsers() {
    $('#page-title').textContent = 'إدارة المستخدمين';
    $('#page-actions').innerHTML = '';
    $('#page-actions').appendChild(btn('➕ مستخدم جديد', openNewUser));
    const c = $('#content'); c.innerHTML = '<div class="card">جارٍ التحميل…</div>';
    const { rows } = await api('/users');
    c.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr>
      <th>الاسم</th><th>البريد</th><th>الدور</th><th>كلمة المرور</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>
      ${rows.map((u, i) => `<tr>
        <td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td>${esc(u.role_name)}</td>
        <td style="white-space:nowrap">
          <span class="pw-mask" id="pwc-${i}">••••••••</span>
          <button class="btn sm ghost" data-pw="${esc(u.password || '')}" onclick="App.revealPw('pwc-${i}', this)" title="إظهار/إخفاء">👁</button>
        </td>
        <td>${u.is_active ? '<span class="badge s-active">نشط</span>' : '<span class="badge s-rejected">معطّل</span>'}</td>
        <td style="white-space:nowrap">
          <button class="btn sm ghost" onclick="App.passwordModal('${u.id}','${esc(u.full_name)}')">🔑 تغيير</button>
          <button class="btn sm ghost" onclick="App.toggleUser('${u.id}')">${u.is_active ? 'تعطيل' : 'تفعيل'}</button>
          <button class="btn sm danger" onclick="App.deleteUser('${u.id}','${esc(u.full_name)}')">🗑 حذف</button>
        </td>
      </tr>`).join('')}</tbody></table></div></div>`;
  }
  function openNewUser() {
    showModal('مستخدم جديد', `<form id="user-form">
      <div class="field"><label>الاسم الكامل</label><input name="full_name" required /></div>
      <div class="field"><label>البريد</label><input type="email" name="email" required /></div>
      <div class="field"><label>الدور</label><select name="role">
        <option value="applicant">مقدّم طلب</option><option value="reviewer">مراجِع</option>
        <option value="supervisor">المشرف</option><option value="general_management">الإدارة العامة</option>
        <option value="support">الدعم الفني</option></select></div>
      <div class="field"><label>كلمة المرور</label>
        <div class="pw-wrap">
          <input type="password" id="newuser-pw" name="password" required minlength="6" />
          <button type="button" class="pw-eye" title="إظهار/إخفاء" onclick="App.togglePw('newuser-pw', this)">👁</button>
        </div></div>
      <button class="btn block" type="submit">إنشاء</button></form>`);
    $('#user-form').onsubmit = async (e) => {
      e.preventDefault(); const f = e.target;
      try { await api('/users', { method: 'POST', body: { full_name: f.full_name.value, email: f.email.value, role: f.role.value, password: f.password.value } });
        toast('تم إنشاء المستخدم', 'success'); closeModal(); viewUsers(); }
      catch (err) { toast(err.message, 'error'); }
    };
  }
  async function toggleUser(id) {
    try { await api(`/users/${id}/toggle`, { method: 'POST' }); viewUsers(); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function deleteUser(id, name) {
    const ok = await confirmModal('حذف مستخدم', `هل تريد حذف المستخدم «${name}» نهائياً؟`, { danger: true });
    if (!ok) return;
    try { const r = await api(`/users/${id}`, { method: 'DELETE' });
      toast(r.deactivated ? 'له طلبات سابقة — تم تعطيله بدل الحذف (للحفاظ على السجل).' : 'تم حذف المستخدم.', 'success');
      viewUsers(); }
    catch (err) { toast(err.message, 'error'); }
  }
  async function passwordModal(id, name) {
    let cur = '';
    try { const r = await api(`/users/${id}/password`); cur = r.password || ''; } catch {}
    showModal(`كلمة المرور — ${esc(name)}`, `
      <div class="field"><label>كلمة المرور الحالية</label>
        <div class="pw-wrap">
          <input id="cur-pw" type="password" readonly value="${esc(cur)}" />
          <button type="button" class="pw-eye" onclick="App.togglePw('cur-pw', this)">👁</button>
        </div>
        ${cur ? '<div class="hint">اضغط العين 👁 لإظهار كلمة المرور الحالية.</div>'
              : '<div class="hint err">غير متاحة للعرض (حساب قديم) — عيّن كلمة مرور جديدة لتُحفظ للعرض لاحقاً.</div>'}
      </div>
      <form id="setpw-form"><div class="field"><label>تعيين كلمة مرور جديدة</label>
        <div class="pw-wrap">
          <input id="new-pw" type="text" placeholder="6 أحرف على الأقل" />
          <button type="button" class="pw-eye" onclick="App.togglePw('new-pw', this)">🙈</button>
        </div></div>
        <button class="btn block" type="submit">حفظ كلمة المرور الجديدة</button></form>`);
    $('#setpw-form').onsubmit = async (e) => {
      e.preventDefault();
      const v = $('#new-pw').value.trim();
      if (v.length < 6) { toast('كلمة المرور يجب ألا تقل عن 6 أحرف.', 'error'); return; }
      try { await api(`/users/${id}/password`, { method: 'POST', body: { password: v } });
        toast('تم تغيير كلمة المرور بنجاح', 'success'); closeModal(); }
      catch (err) { toast(err.message, 'error'); }
    };
  }
  function togglePw(id, btn) {
    const i = document.getElementById(id); if (!i) return;
    const show = i.type === 'password';
    i.type = show ? 'text' : 'password';
    btn.textContent = show ? '🙈' : '👁';
  }
  // إظهار/إخفاء كلمة المرور داخل جدول المستخدمين
  function revealPw(spanId, btn) {
    const span = document.getElementById(spanId); if (!span) return;
    const pw = btn.dataset.pw || '';
    if (span.dataset.shown === '1') { span.textContent = '••••••••'; span.dataset.shown = '0'; btn.textContent = '👁'; }
    else { span.textContent = pw || '— غير متاحة —'; span.dataset.shown = '1'; btn.textContent = '🙈'; }
  }

  // ============================================================
  //  سجل التدقيق
  // ============================================================
  async function viewAudit() {
    $('#page-title').textContent = 'سجل التدقيق';
    const integ = await api('/audit/integrity').catch(() => ({ intact: null }));
    $('#page-actions').innerHTML = integ.intact === true
      ? '<span class="badge s-active">✓ سلسلة السجل سليمة</span>'
      : integ.intact === false ? '<span class="badge s-rejected">⚠ تم العبث بالسجل</span>' : '';
    const { rows } = await api('/audit?pageSize=100');
    const c = $('#content');
    c.innerHTML = `<div class="card"><div class="table-wrap"><table><thead><tr>
      <th>الوقت</th><th>المنفّذ</th><th>الإجراء</th><th>الكيان</th><th>IP</th></tr></thead><tbody>
      ${rows.map((a) => `<tr>
        <td style="font-size:12px">${fmt(a.created_at)}</td><td>${esc(a.actor_name || 'النظام')}</td>
        <td><span class="badge s-new">${esc(a.action)}</span></td><td>${esc(a.entity_type)}</td>
        <td style="font-size:11px">${esc(a.ip_address || '—')}</td></tr>`).join('')}
      </tbody></table></div></div>`;
  }

  const NOTIF_GROUPS = [
    { key: 'expiring', label: 'تصاريح قرب الانتهاء', match: (t) => /ينتهي|الانتهاء|انتهى/.test(t) },
    { key: 'active', label: 'تصاريح مفعّلة / معتمدة', match: (t) => /اعتماد|إصدار|تصريحك/.test(t) },
    { key: 'rejected', label: 'طلبات مرفوضة', match: (t) => /رفض/.test(t) },
    { key: 'info', label: 'طلبات ناقصة (مطلوب معلومات)', match: (t) => /معلومات/.test(t) },
    { key: 'new', label: 'طلبات جديدة', match: (t) => /جديد|استلام|رد المقدّم/.test(t) },
    { key: 'other', label: 'أخرى', match: () => true },
  ];
  async function viewNotifications() {
    $('#page-title').textContent = 'الإشعارات';
    const { rows } = await api('/notifications');
    const c = $('#content');
    for (const n of rows) if (!n.is_read) api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
    $('#bell-count').classList.add('hidden');
    if (!rows.length) { c.innerHTML = '<div class="card empty">لا توجد إشعارات.</div>'; return; }

    // تجميع الإشعارات حسب النوع
    const grouped = {};
    for (const n of rows) {
      const g = NOTIF_GROUPS.find((gr) => gr.match(n.title || ''));
      (grouped[g.key] = grouped[g.key] || []).push(n);
    }
    c.innerHTML = '';
    for (const g of NOTIF_GROUPS) {
      const items = grouped[g.key]; if (!items || !items.length) continue;
      const unreadCount = items.filter((n) => !n.is_read).length;
      const card = el(`<div class="card notif-group">
        <div class="notif-group-head"><span>${g.label} <span class="badge s-new">${items.length}</span></span>
          <button class="btn sm ghost notif-toggle">${items.length > 4 ? 'عرض' : 'إخفاء'}</button></div>
        <div class="notif-list ${items.length > 4 ? 'collapsed' : ''}"></div></div>`);
      const list = card.querySelector('.notif-list');
      items.forEach((n) => {
        const item = el(`<div class="notif ${n.is_read ? '' : 'unread'} ${n.req_id ? 'clickable' : ''}">
          <div class="notif-dot"></div>
          <div class="notif-body"><div class="notif-title">${esc(n.title)}</div>
            <div class="notif-text">${esc(n.body || '')}</div>
            <div class="notif-time">${fmt(n.created_at)}${n.req_id ? ' · اضغط لفتح الطلب' : ''}</div></div></div>`);
        if (n.req_id) item.onclick = () => openRequest(n.req_id);
        list.appendChild(item);
      });
      const tg = card.querySelector('.notif-toggle');
      tg.onclick = () => { list.classList.toggle('collapsed'); tg.textContent = list.classList.contains('collapsed') ? 'عرض' : 'إخفاء'; };
      c.appendChild(card);
    }
  }

  // ---------- مشترك ----------
  function btn(label, onclick, cls = 'btn') { const b = el(`<button class="${cls}">${label}</button>`); b.onclick = onclick; return b; }
  function showModal(title, bodyHtml) {
    $('#modal-root').innerHTML = `<div class="modal-overlay" onclick="if(event.target===this)App.closeModal()">
      <div class="modal"><div class="modal-head"><h3>${esc(title)}</h3><button class="x" onclick="App.closeModal()">×</button></div>
      <div class="modal-body">${bodyHtml}</div></div></div>`;
  }
  function closeModal() { $('#modal-root').innerHTML = ''; }

  // نافذة إدخال حديثة (بديل prompt)
  function promptModal(title, { label = '', placeholder = '', value = '', textarea = false } = {}) {
    return new Promise((resolve) => {
      showModal(title, `<form id="pm-form">
        <div class="field"><label>${esc(label)}</label>
          ${textarea ? `<textarea name="v" placeholder="${esc(placeholder)}">${esc(value)}</textarea>`
            : `<input name="v" value="${esc(value)}" placeholder="${esc(placeholder)}" />`}</div>
        <div style="display:flex;gap:8px">
          <button class="btn block" type="submit">تأكيد</button>
          <button class="btn ghost" type="button" id="pm-cancel">إلغاء</button>
        </div></form>`);
      const f = $('#pm-form');
      f.onsubmit = (e) => { e.preventDefault(); const v = f.v.value.trim(); closeModal(); resolve(v); };
      $('#pm-cancel').onclick = () => { closeModal(); resolve(null); };
      setTimeout(() => f.v.focus(), 60);
    });
  }
  // نافذة تأكيد حديثة (بديل confirm)
  function confirmModal(title, message, { danger = false } = {}) {
    return new Promise((resolve) => {
      showModal(title, `<p style="margin-bottom:18px">${esc(message)}</p>
        <div style="display:flex;gap:8px">
          <button class="btn ${danger ? 'danger' : ''}" id="cm-yes">نعم، متابعة</button>
          <button class="btn ghost" id="cm-no">إلغاء</button>
        </div>`);
      $('#cm-yes').onclick = () => { closeModal(); resolve(true); };
      $('#cm-no').onclick = () => { closeModal(); resolve(false); };
    });
  }

  // ---------- الوضع الداكن/الفاتح ----------
  applyTheme();

  // ---------- تكبير/تصغير الخط ----------
  function applyFontSize(z) {
    z = Math.min(130, Math.max(85, z));
    document.documentElement.style.zoom = z + '%';
    const lbl = $('#fs-label'); if (lbl) lbl.textContent = z + '%';
    localStorage.setItem('pams-zoom', z);
    return z;
  }
  function fontSize(delta) {
    const cur = Number(localStorage.getItem('pams-zoom')) || 100;
    applyFontSize(cur + delta * 5);
  }
  applyFontSize(Number(localStorage.getItem('pams-zoom')) || 100);

  async function boot() {
    // دخول مباشر عبر رابط واتساب: الخادم ضبط الكوكي وحوّل إلى /?m=1 — أبقِ الجلسة ولا تُسجّل خروجاً تلقائياً
    if (/[?&]m=1\b/.test(location.search)) {
      sessionStorage.setItem('pams-tab', '1');
      history.replaceState(null, '', '/');
    }
    try {
      const { user: u } = await api('/auth/me');
      // إذا فُتح تبويب جديد أو أُعيد فتح الصفحة بعد إغلاقها → تسجيل خروج تلقائي
      // تبويب جديد بلا علامة جلسة: لا ندخل التطبيق هنا (نعرض الدخول) دون إنهاء جلسة الخادم — حتى لا نُخرج التبويب النشط
      if (!sessionStorage.getItem('pams-tab')) { return; }
      user = u; enterApp();
    } catch {}
  }
  boot();

  function renewPermit(nid) { prefillNid = nid; route('new-request'); }
  return { login, logout, route, refresh, toggleNav, fontSize, commandPalette, toggleTheme, act, approveIssue, cancelPermit, deletePermit, toggleUser, deleteUser, passwordModal, togglePw, revealPw, renewPermit, closeModal };
})();
