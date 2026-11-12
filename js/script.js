/* ---------- PUBLIC SITE: dynamic logo + slider + images ---------- */
function staGet(key, fallback) {
  try { const v = localStorage.getItem('sta_' + key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
}

async function staImageGet(key) {
  try {
    if (typeof ImageStore !== 'undefined') {
      const v = await ImageStore.get(key);
      if (v) return v;
    }
  } catch (e) { /* ignore */ }
  const value = staGet(key, null);
  if (value && typeof ImageUpload !== 'undefined') return ImageUpload.assetURL(value);
  return value;
}

const STA_SCHOOL_NAME = 'St. Teresa Kanyange Academy';

async function loadSiteLogo() {
  const logo = staGet('logo', null);
  const logoImage = await staImageGet('logoImage');
  if (!logo && !logoImage) return;
  if (logo && logo.name && logo.name.trim() !== STA_SCHOOL_NAME && /^st\.?\s*teresa\s+academy$/i.test(logo.name.trim())) {
    logo.name = STA_SCHOOL_NAME;
    try { localStorage.setItem('sta_logo', JSON.stringify(logo)); } catch (e) { /* ignore */ }
  }
  document.querySelectorAll('.brand-crest').forEach(el => {
    if (logoImage) {
      el.innerHTML = `<img src="${logoImage}" alt="Logo" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else if (logo && logo.initials) {
      el.textContent = logo.initials;
    }
  });
  if (logo && logo.name) {
    document.querySelectorAll('.brand-text h1, .footer-brand h1').forEach(el => {
      el.textContent = logo.name;
    });
  }
}

let heroSlideIndex = 0;
let heroSlideTimer = null;

async function loadSiteImages() {
  const story = await staImageGet('aboutImage');
  if (story) {
    const el = document.getElementById('storyImage');
    if (el) el.src = story;
  }
  const campus = await staImageGet('campusImage');
  if (campus) {
    const el = document.getElementById('campusImage');
    if (el) el.src = campus;
  }

  // program card images
  const progEarly = await staImageGet('progEarly');
  if (progEarly) setProgramImage('progEarlyCard', progEarly);
  const progElem = await staImageGet('progElem');
  if (progElem) setProgramImage('progElemCard', progElem);
  const progMiddle = await staImageGet('progMiddle');
  if (progMiddle) setProgramImage('progMiddleCard', progMiddle);

  // CTA banner background
  const cta = await staImageGet('ctaImage');
  if (cta) {
    const el = document.getElementById('ctaBanner');
    if (el) el.style.background = `linear-gradient(135deg, rgba(15,44,76,0.88), rgba(10,30,52,0.82)), url('${cta}') center/cover no-repeat`;
  }

  // custom favicon
  const favicon = await staImageGet('favicon');
  if (favicon) {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = favicon;
    if (/^data:image\/png/i.test(favicon) || /\.png(?:[?#]|$)/i.test(favicon)) link.type = 'image/png';
    else if (/^data:image\/webp/i.test(favicon) || /\.webp(?:[?#]|$)/i.test(favicon)) link.type = 'image/webp';
    else if (/^data:image\/gif/i.test(favicon) || /\.gif(?:[?#]|$)/i.test(favicon)) link.type = 'image/gif';
    else if (/^data:image\/jpe?g/i.test(favicon) || /\.jpe?g(?:[?#]|$)/i.test(favicon)) link.type = 'image/jpeg';
    else link.type = 'image/x-icon';
  }
}

function setProgramImage(id, src) {
  const el = document.getElementById(id);
  if (!el) return;
  el.style.background = `linear-gradient(180deg, rgba(15,44,76,0.15), rgba(15,44,76,0.05)), url('${src}') center/cover no-repeat`;
  el.style.height = '150px';
}

function renderLeadership() {
  const facultyGrid = document.getElementById('facultyGrid');
  const leadershipGrid = document.getElementById('leadershipGrid');
  if (!facultyGrid && !leadershipGrid) return;

  let leaders = [];
  try { leaders = JSON.parse(localStorage.getItem('sta_leadership') || '[]'); } catch (e) { leaders = []; }
  const shown = leaders
    .filter(l => l.status !== 'inactive' && l.published !== false)
    .sort((a, b) => posOrder(a.position) - posOrder(b.position));

  const cardHTML = l => {
    const label = l.position === 'headteacher' ? 'Headteacher' : (l.position === 'director2' ? 'Director 2' : 'Director 1');
    const nm = l.name || '';
    return `
    <div class="teacher-card reveal">
      <div class="teacher-avatar">
        ${l.photo
          ? `<img src="${l.photo}" alt="${escPublic(nm)}" style="width:100%;height:100%;object-fit:cover">`
          : `<i class="fas fa-user-tie"></i>`}
      </div>
      <div class="teacher-info">
        <h3>${escPublic(nm)}</h3>
        <span class="subject">${escPublic(l.title || label)}</span>
        <p>${escPublic(l.bio || '')}</p>
      </div>
    </div>`;
  };

  const html = shown.length
    ? shown.map(cardHTML).join('')
    : `<div class="empty-state" style="width:100%;text-align:center;padding:40px;color:var(--text-light)"><i class="fas fa-user-tie" style="font-size:2rem;color:var(--border);display:block;margin-bottom:10px"></i><h4 style="color:var(--navy)">Leadership profiles coming soon</h4><p style="font-size:0.9rem">Profiles will appear here once added in the admin panel.</p></div>`;

  if (facultyGrid) facultyGrid.innerHTML = html;
  if (leadershipGrid) leadershipGrid.innerHTML = html;
}

function posOrder(p) {
  return p === 'director1' ? 0 : p === 'director2' ? 1 : p === 'headteacher' ? 2 : 3;
}

function escPublic(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function initHeroSlider() {
  const wrap = document.getElementById('heroSlides');
  if (!wrap) return;
  const slides = staGet('slider', []);
  if (!slides.length) return;

  // resolve image sources (URL or IndexedDB-stored uploads)
  const resolved = await Promise.all(slides.map(async sl => {
    let src = sl.imageUrl || '';
    if (!src && sl.imageKey && typeof ImageStore !== 'undefined') {
      try { src = await ImageStore.get(sl.imageKey) || ''; } catch (e) { src = ''; }
    }
    if (src && typeof ImageUpload !== 'undefined') src = ImageUpload.assetURL(src);
    return { ...sl, src };
  }));

  wrap.innerHTML = resolved.map((sl, i) => `
    <div class="hero-slide ${i === 0 ? 'active' : ''}" style="background:linear-gradient(135deg, rgba(15,44,76,0.92), rgba(26,61,95,0.85))${sl.src ? `, url('${sl.src}')` : ''} center/cover no-repeat">
      <div class="container hero-slide-content">
        <h2>${sl.title || 'Welcome to St. Teresa Kanyange Academy'}</h2>
        ${sl.description ? `<p class="hero-slide-desc">${sl.description}</p>` : ''}
      </div>
    </div>`).join('');

  // dots
  const dotsWrap = document.getElementById('heroDots');
  if (dotsWrap) {
    dotsWrap.innerHTML = resolved.map((_, i) => `<button class="hero-dot ${i === 0 ? 'active' : ''}" onclick="goHeroSlide(${i})" aria-label="Slide ${i + 1}"></button>`).join('');
  }

  heroSlideIndex = 0;
  if (heroSlideTimer) clearInterval(heroSlideTimer);
  heroSlideTimer = setInterval(() => goHeroSlide(heroSlideIndex + 1), 6000);
}

function goHeroSlide(i) {
  const slidesWrap = document.getElementById('heroSlides');
  if (!slidesWrap) return;
  const total = slidesWrap.children.length;
  if (!total) return;
  heroSlideIndex = ((i % total) + total) % total;
  [...slidesWrap.children].forEach((c, idx) => c.classList.toggle('active', idx === heroSlideIndex));
  document.querySelectorAll('.hero-dot').forEach((d, idx) => d.classList.toggle('active', idx === heroSlideIndex));
}

document.addEventListener('DOMContentLoaded', () => {
  loadSiteLogo();
  loadSiteImages();
  renderLeadership();
  initHeroSlider();

  // Mobile nav toggle
  const hamburger = document.querySelector('.hamburger');
  const nav = document.querySelector('.nav');
  const overlay = document.querySelector('.nav-overlay');

  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('open');
      if (overlay) overlay.classList.toggle('open');
    });

    if (overlay) {
      overlay.addEventListener('click', () => {
        nav.classList.remove('open');
        overlay.classList.remove('open');
      });
    }

    document.querySelectorAll('.nav a').forEach(link => {
      link.addEventListener('click', () => {
        nav.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
      });
    });
  }

  // Back to top button
  const backToTop = document.querySelector('.back-to-top');
  if (backToTop) {
    window.addEventListener('scroll', () => {
      backToTop.classList.toggle('visible', window.scrollY > 400);
    });
    backToTop.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // FAQ accordion
  document.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item = btn.parentElement;
      const answer = item.querySelector('.faq-answer');
      const isOpen = item.classList.contains('active');

      document.querySelectorAll('.faq-item').forEach(faq => {
        faq.classList.remove('active');
        faq.querySelector('.faq-answer').style.maxHeight = null;
      });

      if (!isOpen) {
        item.classList.add('active');
        answer.style.maxHeight = answer.scrollHeight + 'px';
      }
    });
  });

  // Scroll reveal animation
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => observer.observe(el));
  }

  // Animated counters
  const counters = document.querySelectorAll('.stat-number');
  if (counters.length) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const target = parseInt(el.dataset.target, 10);
          const suffix = el.dataset.suffix || '';
          const duration = 1600;
          const step = Math.ceil(target / (duration / 16));
          let current = 0;

          const timer = setInterval(() => {
            current += step;
            if (current >= target) {
              current = target;
              clearInterval(timer);
            }
            el.textContent = current.toLocaleString() + suffix;
          }, 16);

          counterObserver.unobserve(el);
        }
      });
    }, { threshold: 0.5 });
    counters.forEach(el => counterObserver.observe(el));
  }

  // Contact form handling
  const contactForm = document.getElementById('contactForm');
  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = contactForm.querySelector('[name="name"]').value.trim();
      const email = contactForm.querySelector('[name="email"]').value.trim();
      const phoneEl = contactForm.querySelector('[name="phone"]');
      const interestEl = contactForm.querySelector('[name="interest"]');
      const phone = phoneEl ? phoneEl.value.trim() : '';
      const interest = interestEl ? interestEl.value : '';
      const message = contactForm.querySelector('[name="message"]').value.trim();

      if (!name || !email || !message) {
        showFormMessage('Please fill in all required fields.', 'error');
        return;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showFormMessage('Please enter a valid email address.', 'error');
        return;
      }

      // Persist the message so the Admin / Secretary portal can read it.
      // Shared across every page of this site on this browser (localStorage).
      try {
        var KEY = 'sta_contactMessages';
        var messages = [];
        try { messages = JSON.parse(localStorage.getItem(KEY)) || []; } catch (err) { messages = []; }
        if (!Array.isArray(messages)) messages = [];
        messages.push({
          id: 'msg_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
          name: name,
          email: email,
          phone: phone,
          interest: interest,
          message: message,
          at: new Date().toISOString(),
          read: false,
          readAt: '',
          readBy: ''
        });
        localStorage.setItem(KEY, JSON.stringify(messages));
      } catch (err) { /* storage full or blocked — the visitor still gets a confirmation */ }

      showFormMessage(`Thank you, ${name}! Your message has been received. We will get back to you soon.`, 'success');
      contactForm.reset();
    });
  }

  function showFormMessage(text, type) {
    const existing = document.querySelector('.form-message');
    if (existing) existing.remove();

    const msg = document.createElement('div');
    msg.className = `form-message ${type}`;
    msg.textContent = text;
    msg.style.cssText = `
      padding: 14px 18px;
      border-radius: 8px;
      margin-bottom: 18px;
      font-family: Arial, sans-serif;
      font-size: 0.92rem;
      font-weight: 600;
      ${type === 'success'
        ? 'background:#d4edda;color:#155724;border:1px solid #c3e6cb;'
        : 'background:#f8d7da;color:#721c24;border:1px solid #f5c6cb;'}
    `;
    contactForm.prepend(msg);
  }

  // Set active nav link based on current page
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav a').forEach(link => {
    const href = link.getAttribute('href');
    if (href === currentPage) {
      link.classList.add('active');
    }
  });
});
