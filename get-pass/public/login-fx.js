/*
 * login-fx.js — مؤثرات وتفاعلات صفحة الدخول فقط (MAB × Qiddiya)
 * معزول تماماً عن منطق التطبيق: لا يلمس المصادقة أو التوجيه أو الـAPI.
 * يعمل فقط على عناصر #auth. كل شيء CSS/SVG خفيف (60fps).
 */
(function () {
  'use strict';
  const auth = document.getElementById('auth');
  if (!auth) return;

  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ===== رسالة HUD عائمة (للرافعة) ===== */
  const hud = document.createElement('div');
  hud.className = 'fx-hud';
  auth.appendChild(hud);
  let hudTimer;
  function hudMsg(text, x, y) {
    hud.textContent = text;
    const w = auth.getBoundingClientRect();
    let cx = (x != null ? x : w.left + w.width / 2);
    let cy = (y != null ? y : w.top + 80);
    cx = Math.max(w.left + 90, Math.min(cx, w.right - 90));
    cy = Math.max(w.top + 50, Math.min(cy, w.bottom - 40));
    hud.style.left = (cx - w.left) + 'px';
    hud.style.top = (cy - w.top) + 'px';
    hud.classList.remove('show');
    void hud.offsetWidth;
    hud.classList.add('show');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hud.classList.remove('show'), 2600);
  }

  /* ===== بطاقة تعريفية موحّدة ===== */
  const modal = document.createElement('div');
  modal.className = 'fx-welcome';
  modal.innerHTML =
    '<div class="fxw-card">' +
      '<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span class="corner br"></span>' +
      '<button class="fxw-close" type="button" aria-label="إغلاق">✕</button>' +
      '<div class="fxw-body"></div>' +
    '</div>';
  auth.appendChild(modal);
  const modalBody = modal.querySelector('.fxw-body');
  let modalCloseCb = null, modalTimer;

  function openInfo(html, onClose) {
    modalBody.innerHTML = html;
    modalCloseCb = onClose || null;
    modal.classList.add('show');
    modal.querySelector('.fxw-card').scrollTop = 0;
    clearTimeout(modalTimer);
    modalTimer = setTimeout(closeInfo, 22000); // إغلاق تلقائي احتياطي
  }
  function closeInfo() {
    if (!modal.classList.contains('show')) return;
    modal.classList.remove('show');
    clearTimeout(modalTimer);
    const cb = modalCloseCb; modalCloseCb = null;
    if (cb) cb();
  }
  modal.querySelector('.fxw-close').addEventListener('click', closeInfo);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeInfo(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeInfo(); });

  /* ===== محتوى البطاقات ===== */
  const INFO = {
    permit:
      '<div class="fxw-icon">🔐</div>' +
      '<h3>نظام التصاريح والموافقات</h3>' +
      '<p class="fxw-sub">منصّة MAB لإدارة التصاريح إلكترونياً</p>' +
      '<ul class="fxw-list">' +
        '<li>📝 تقديم طلبات تصاريح الدخول والعمل إلكترونياً</li>' +
        '<li>✅ مراجعة الطلبات واعتمادها وإصدار التصاريح رسمياً</li>' +
        '<li>📄 تصدير بيانات التصاريح بصيغة Excel للجهات المعنية</li>' +
        '<li>🔔 إشعارات فورية وتنبيهات قبل انتهاء التصاريح</li>' +
      '</ul>',
    howto:
      '<div class="fxw-icon">🚁</div>' +
      '<h3>طريقة الاستخدام</h3>' +
      '<p class="fxw-sub">تسجيل الدخول وإنشاء التصاريح</p>' +
      '<ol class="fxw-list fxw-num">' +
        '<li>سجّل الدخول بالبريد الإلكتروني وكلمة المرور الخاصة بك.</li>' +
        '<li>من القائمة الجانبية اختر «تقديم طلب تصريح جديد».</li>' +
        '<li>أدخل بيانات صاحب التصريح وارفع المستندات المطلوبة.</li>' +
        '<li>أرسل الطلب — يراجعه المختص ثم يعتمده ويُصدر التصريح.</li>' +
        '<li>تابع حالة طلباتك وتصاريحك من صفحة «طلباتي».</li>' +
      '</ol>',
    mab:
      '<div class="fxw-icon">🏗️</div>' +
      '<h3>شركة MAB United</h3>' +
      '<p class="fxw-sub">شركة مقاولات رائدة</p>' +
      '<p class="fxw-text">في <b>MAB United</b> نسعى لأن نكون الشركة الرائدة في قطاع المقاولات عبر تقديم خدمات عالية الجودة في الأعمال المدنية، والتشطيبات، والأعمال الكهروميكانيكية، وواجهات المباني.</p>' +
      '<p class="fxw-text">رسالتنا تجاوز توقعات عملائنا باستخدام تقنيات وأساليب مبتكرة لتقديم حلول فعّالة من حيث التكلفة تُلبّي احتياجاتهم.</p>' +
      '<p class="fxw-text">ونلتزم ببناء علاقات طويلة الأمد قائمة على الثقة والاحترام المتبادل والشفافية في جميع تعاملاتنا، وهدفنا الأسمى الإسهام في تطوير المجتمعات ببناء بنية تحتية عملية ومستدامة تُقدّم قيمة دائمة للمجتمع.</p>',
  };

  /* ===== درون الأمن MAB — يلفّ ثم يقترب نحو الشاشة ثم نور + بطاقة ===== */
  const drone = auth.querySelector('.fx-drone');
  if (drone) {
    const inner = drone.querySelector('.drone-inner');
    let droneBusy = false;

    function flashLight() {
      const f = document.createElement('div');
      f.className = 'fx-flash';
      auth.appendChild(f);
      setTimeout(() => f.remove(), 950);
    }
    function restoreDrone() {
      drone.style.transition = 'opacity .45s ease';
      drone.style.opacity = '0';
      setTimeout(() => {
        drone.classList.remove('active');
        drone.removeAttribute('style');         // العودة لمساره الطبيعي
        if (inner) inner.style.animation = '';
        void drone.offsetWidth;
        drone.style.opacity = '0';
        drone.style.transition = 'opacity .5s ease';
        requestAnimationFrame(() => { drone.style.opacity = '1'; });
        setTimeout(() => { drone.style.transition = ''; drone.style.opacity = ''; droneBusy = false; }, 520);
      }, 450);
    }

    drone.addEventListener('click', () => {
      if (reduce) { openInfo(INFO.howto); return; }
      if (droneBusy) return;
      droneBusy = true;

      const r = drone.getBoundingClientRect();
      // تثبيت الموضع الحالي بدون قفز
      drone.style.transition = 'none';
      drone.style.animation = 'none';
      drone.style.position = 'fixed';
      drone.style.left = r.left + 'px';
      drone.style.top = r.top + 'px';
      drone.style.width = r.width + 'px';
      drone.style.margin = '0';
      drone.style.zIndex = '9';
      drone.style.transform = 'none';
      if (inner) inner.style.animation = 'none';
      drone.classList.add('active');            // شعاع المسح
      void drone.offsetWidth;

      const cx = window.innerWidth / 2 - (r.left + r.width / 2);
      const cy = window.innerHeight * 0.42 - (r.top + r.height / 2);

      // مسار يطوف الشاشة كاملة (قرب الزوايا) ثم لفّة ثم اقتراب
      const W = window.innerWidth, H = window.innerHeight, ox = r.left, oy = r.top;
      const at = (fx, fy) => 'translate(' + Math.round(W * fx - ox) + 'px,' + Math.round(H * fy - oy) + 'px)';
      const legs = [at(.80, .15), at(.82, .72), at(.14, .73), at(.13, .16)]; // يمين-أعلى → يمين-أسفل → يسار-أسفل → يسار-أعلى
      const LEG = 560;

      // الانطلاق للطواف
      drone.style.transition = 'transform .56s linear';
      drone.style.transform = legs[0] + ' rotate(8deg) scale(1.05)';
      for (let i = 1; i < legs.length; i++) {
        setTimeout(() => {
          drone.style.transition = 'transform .56s linear';
          drone.style.transform = legs[i] + ' scale(1.05)';
        }, LEG * i);
      }

      const spinAt = LEG * legs.length;          // لفّة في آخر زاوية
      setTimeout(() => {
        drone.style.transition = 'transform .6s ease';
        drone.style.transform = at(.13, .16) + ' rotate(360deg) scale(1.3)';
      }, spinAt);

      const approachAt = spinAt + 600;            // يقترب نحوك ويكبر
      setTimeout(() => {
        drone.style.transition = 'transform 1s cubic-bezier(.2,.7,.2,1)';
        drone.style.transform = 'translate(' + cx + 'px,' + cy + 'px) rotate(360deg) scale(3.4)';
      }, approachAt);

      setTimeout(() => {                          // نور + يمرّ + بطاقة
        flashLight();
        drone.style.transition = 'transform .5s ease, opacity .5s ease';
        drone.style.transform = 'translate(' + cx + 'px,' + cy + 'px) scale(5.4)';
        drone.style.opacity = '0';
        openInfo(INFO.howto, restoreDrone);
      }, approachAt + 1000);
    });
  }

  /* ===== مركبة الخدمة MAB — توقّف بسيط + بطاقة تعريفية ===== */
  const veh = auth.querySelector('.fx-vehicle');
  if (veh) {
    veh.addEventListener('click', () => {
      veh.classList.add('stopped');
      openInfo(INFO.permit, () => veh.classList.remove('stopped'));
    });
  }

  /* ===== رافعة البناء ===== */
  const crane = auth.querySelector('.fx-crane');
  if (crane) {
    crane.addEventListener('click', (e) => {
      crane.classList.add('ping');
      setTimeout(() => crane.classList.remove('ping'), 700);
      hudMsg('Project Progress 87%', e.clientX, e.clientY - 16);
    });
  }

  /* ===== شعار MAB ===== */
  const logo = auth.querySelector('.auth-logo-wrap');
  if (logo) {
    logo.addEventListener('click', () => {
      logo.classList.add('pulse');
      setTimeout(() => logo.classList.remove('pulse'), 950);
      openInfo(INFO.mab);
    });
  }

  /* ===== إمالة 3D خفيفة للبطاقة ===== */
  const card = auth.querySelector('.auth-card.glass');
  const main = auth.querySelector('.auth-main');
  if (card && main && !reduce && window.matchMedia('(pointer: fine)').matches) {
    let raf = 0;
    main.addEventListener('mousemove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        card.style.transform = `perspective(950px) rotateY(${px * 6}deg) rotateX(${-py * 6}deg)`;
      });
    });
    main.addEventListener('mouseleave', () => { card.style.transform = ''; });
  }

  /* ===== المشهد الحيّ: ليل/نهار + ساعة + صوت + طائرة + نجوم ===== */
  (function scene() {
    // ليل/نهار حسب الساعة
    function setTOD() {
      const h = new Date().getHours();
      const tod = (h >= 6 && h < 17) ? 'day' : (h >= 17 && h < 19) ? 'dusk' : 'night';
      auth.classList.remove('tod-day', 'tod-dusk', 'tod-night');
      auth.classList.add('tod-' + tod);
    }
    setTOD();
    setInterval(setTOD, 60000);

    // نجوم
    const stars = auth.querySelector('.stars');
    if (stars && !stars.childElementCount) {
      let h = '';
      for (let i = 0; i < 46; i++) {
        const x = (Math.random() * 100).toFixed(1), y = (Math.random() * 100).toFixed(1);
        const s = (Math.random() * 1.6 + 1).toFixed(1), d = (Math.random() * 3 + 1.5).toFixed(1), de = (Math.random() * 4).toFixed(1);
        h += '<i style="left:' + x + '%;top:' + y + '%;width:' + s + 'px;height:' + s + 'px;animation-duration:' + d + 's;animation-delay:' + de + 's"></i>';
      }
      stars.innerHTML = h;
    }

    // ساعة وتاريخ حيّ
    const clock = auth.querySelector('.fx-clock');
    if (clock) {
      const tEl = clock.querySelector('.c-time'), dEl = clock.querySelector('.c-date');
      const fT = new Intl.DateTimeFormat('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const fD = new Intl.DateTimeFormat('ar', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const upd = () => { const n = new Date(); tEl.textContent = fT.format(n); dEl.textContent = fD.format(n); };
      upd(); setInterval(upd, 1000);
    }

    // صوت اختياري (طنين الدرون + نقرة) — مولّد بدون ملفات
    const sbtn = auth.querySelector('.fx-sound');
    let actx = null, humGain = null, soundOn = false;
    function ensureCtx() { if (!actx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) actx = new AC(); } return actx; }
    function startHum() {
      if (!ensureCtx() || humGain) return;
      const osc = actx.createOscillator(), lfo = actx.createOscillator(), lfoG = actx.createGain();
      humGain = actx.createGain();
      osc.type = 'sawtooth'; osc.frequency.value = 68;
      lfo.frequency.value = 7; lfoG.gain.value = 10; lfo.connect(lfoG); lfoG.connect(osc.frequency);
      humGain.gain.value = 0; osc.connect(humGain); humGain.connect(actx.destination);
      osc.start(); lfo.start();
      humGain.gain.linearRampToValueAtTime(0.04, actx.currentTime + 1);
    }
    window.__pamsBeep = function () {
      if (!soundOn || !actx) return;
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = 640; g.gain.value = 0.05;
      o.connect(g); g.connect(actx.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.15); o.stop(actx.currentTime + 0.16);
    };
    if (sbtn) {
      soundOn = localStorage.getItem('pams_sound') === '1';
      sbtn.classList.toggle('on', soundOn);
      sbtn.addEventListener('click', () => {
        soundOn = !soundOn;
        localStorage.setItem('pams_sound', soundOn ? '1' : '0');
        sbtn.classList.toggle('on', soundOn);
        if (soundOn) { ensureCtx(); if (actx && actx.resume) actx.resume(); if (!humGain) startHum(); else humGain.gain.linearRampToValueAtTime(0.04, actx.currentTime + 0.6); }
        else if (humGain) humGain.gain.linearRampToValueAtTime(0, actx.currentTime + 0.4);
      });
      auth.addEventListener('click', (e) => {
        if (e.target.closest('.fx-drone,.fx-crane,.fx-vehicle,.auth-logo-wrap')) window.__pamsBeep();
      });
    }

    // طائرة تمرّ أحياناً
    const plane = auth.querySelector('.fx-plane');
    if (plane && !reduce) {
      const fly = () => { plane.classList.remove('go'); void plane.offsetWidth; plane.classList.add('go'); };
      setTimeout(fly, 4500);
      setInterval(fly, 34000);
    }
  })();

  /* ===== تسلسل الإقلاع ===== */
  function runBoot() {
    if (reduce) { auth.classList.add('ready'); return; }
    const boot = document.createElement('div');
    boot.className = 'fx-boot';
    boot.innerHTML =
      '<div class="boot-box">' +
        '<div class="boot-title">MAB <span>×</span> Qiddiya</div>' +
        '<ul class="boot-lines">' +
          '<li>INITIALIZING SECURITY SYSTEM...</li>' +
          '<li>CONNECTING TO MAB NETWORK...</li>' +
          '<li>VERIFYING ACCESS CONTROL...</li>' +
          '<li class="ok">SYSTEM READY</li>' +
        '</ul>' +
        '<div class="boot-bar"><span></span></div>' +
      '</div>';
    auth.appendChild(boot);
    auth.classList.add('booting');
    const LINES = 4, STEP = 480, OUT = 520;
    const total = LINES * STEP + 300;
    setTimeout(() => boot.classList.add('out'), total);
    setTimeout(() => {
      boot.remove();
      auth.classList.remove('booting');
      auth.classList.add('ready');
    }, total + OUT);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runBoot, { once: true });
  } else {
    runBoot();
  }
})();
