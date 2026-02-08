/* ============================================
   Main Application Logic
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
  initHeader();
  initMobileNav();
  initAuthNav();
  initHeroParticles();
  initScrollAnimations();
});

/* ---------- Header Scroll Effect ---------- */
function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
}

/* ---------- Mobile Navigation ---------- */
function initMobileNav() {
  const toggle = document.querySelector('.mobile-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (!toggle || !mobileNav) return;

  toggle.addEventListener('click', () => {
    mobileNav.classList.toggle('open');
    const icon = toggle.querySelector('i');
    if (mobileNav.classList.contains('open')) {
      icon.className = 'fas fa-times';
    } else {
      icon.className = 'fas fa-bars';
    }
  });

  // Close on link click
  mobileNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      mobileNav.classList.remove('open');
      toggle.querySelector('i').className = 'fas fa-bars';
    });
  });
}

/* ---------- Dynamic Auth Navigation ---------- */
function initAuthNav() {
  if (typeof Auth === 'undefined') return;

  const navAuth = document.querySelector('.nav-auth');
  const mobileNav = document.querySelector('.mobile-nav');

  if (Auth.isLoggedIn()) {
    const user = Auth.getUser();
    if (!user) return;

    const initials = (user.avatar || (user.first_name[0] + user.last_name[0])).toUpperCase();
    const fullName = user.first_name + ' ' + user.last_name;

    // Desktop nav
    if (navAuth) {
      const avatarHtml = typeof getAvatarHtml === 'function' ? getAvatarHtml(user, 36, '0.85rem') : '<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.85rem;flex-shrink:0;">' + initials + '</div>';
      navAuth.innerHTML = `
        <div class="nav-user" id="navUserDropdown">
          ${avatarHtml}
          <span class="nav-user-name">${fullName}</span>
          <i class="fas fa-chevron-down nav-user-chevron"></i>
          <div class="nav-dropdown">
            <div class="nav-dropdown-header">
              <div class="name">${fullName}</div>
              <div class="email">${user.email || ''}</div>
            </div>
            ${user.role === 'admin' ? '<a href="admin/dashboard.html"><i class="fas fa-tachometer-alt"></i> Admin Dashboard</a>' : ''}
            <a href="my-events.html"><i class="fas fa-calendar-alt"></i> My Events</a>
            <a href="wishlist.html"><i class="fas fa-heart"></i> Wishlist</a>
            <a href="profile.html"><i class="fas fa-user"></i> My Profile</a>
            <a href="notifications.html"><i class="fas fa-bell"></i> Notifications</a>
            <a href="settings.html"><i class="fas fa-cog"></i> Settings</a>
            <div class="divider"></div>
            <button class="logout-item" onclick="Auth.logout()"><i class="fas fa-sign-out-alt"></i> Log Out</button>
          </div>
        </div>
      `;

      // Toggle dropdown on click
      const userBtn = document.getElementById('navUserDropdown');
      if (userBtn) {
        userBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          this.classList.toggle('open');
        });
      }

      // Close dropdown on outside click
      document.addEventListener('click', function() {
        var dd = document.getElementById('navUserDropdown');
        if (dd) dd.classList.remove('open');
      });
    }

    // Mobile nav
    if (mobileNav) {
      // Remove existing login/signup links
      var links = mobileNav.querySelectorAll('a');
      links.forEach(function(l) {
        var h = l.getAttribute('href') || '';
        if (h.includes('login') || h.includes('register')) l.remove();
      });
      var hrs = mobileNav.querySelectorAll('hr');
      hrs.forEach(function(hr) { hr.remove(); });

      // Add user links
      var userLinks = document.createElement('div');
      userLinks.innerHTML = `
        <hr style="border-color:var(--border);margin:8px 0;">
        <div style="display:flex;align-items:center;gap:10px;padding:8px 0;margin-bottom:4px;">
          ${typeof getAvatarHtml === 'function' ? getAvatarHtml(user, 32, '0.75rem') : '<div style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:0.75rem;">' + initials + '</div>'}
          <span style="font-weight:600;font-size:0.9rem;">${fullName}</span>
        </div>
        ${user.role === 'admin' ? '<a href="admin/dashboard.html"><i class="fas fa-tachometer-alt" style="width:20px;margin-right:6px;"></i> Admin Dashboard</a>' : ''}
        <a href="my-events.html"><i class="fas fa-calendar-alt" style="width:20px;margin-right:6px;"></i> My Events</a>
        <a href="wishlist.html"><i class="fas fa-heart" style="width:20px;margin-right:6px;"></i> Wishlist</a>
        <a href="profile.html"><i class="fas fa-user" style="width:20px;margin-right:6px;"></i> My Profile</a>
        <a href="notifications.html"><i class="fas fa-bell" style="width:20px;margin-right:6px;"></i> Notifications</a>
        <a href="settings.html"><i class="fas fa-cog" style="width:20px;margin-right:6px;"></i> Settings</a>
        <hr style="border-color:var(--border);margin:8px 0;">
        <a href="#" onclick="event.preventDefault(); Auth.logout();" style="color:var(--danger);"><i class="fas fa-sign-out-alt" style="width:20px;margin-right:6px;"></i> Log Out</a>
      `;
      mobileNav.appendChild(userLinks);
    }
  }
}

/* ---------- Hero Floating Particles ---------- */
function initHeroParticles() {
  const container = document.querySelector('.hero-particles');
  if (!container) return;

  for (let i = 0; i < 30; i++) {
    const particle = document.createElement('div');
    particle.className = 'particle';
    particle.style.left = Math.random() * 100 + '%';
    particle.style.width = (Math.random() * 4 + 2) + 'px';
    particle.style.height = particle.style.width;
    particle.style.animationDuration = (Math.random() * 15 + 10) + 's';
    particle.style.animationDelay = (Math.random() * 10) + 's';
    container.appendChild(particle);
  }
}

/* ---------- Scroll Animations ---------- */
function initScrollAnimations() {
  const elements = document.querySelectorAll('.fade-in-on-scroll');
  if (!elements.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-in');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  elements.forEach(el => observer.observe(el));
}

/* ---------- Render Event Cards ---------- */
async function renderEventCards(containerId, events, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const list = limit ? events.slice(0, limit) : events;

  // Bulk-check wishlist state from API
  var wishlistedIds = [];
  if (Auth.isLoggedIn() && typeof WishlistAPI !== 'undefined') {
    try {
      var ids = list.map(function(e) { return e.id; });
      var wData = await WishlistAPI.checkBulk(ids);
      wishlistedIds = wData.wishlisted || [];
    } catch(e) { /* ignore */ }
  }

  container.innerHTML = list.map(event => {
    var isWished = wishlistedIds.includes(event.id);
    return `
    <div class="event-card" onclick="window.location.href='event-detail.html?id=${event.id}'">
      <div class="event-card-img">
        ${event.image_url
          ? '<img src="' + getEventImageUrl(event.image_url) + '" alt="' + event.title + '">'
          : '<div class="placeholder-img" style="' + event.gradient + '"><i class="' + event.icon + '"></i></div>'
        }
        <div class="event-badge">${getStatusBadge(event.status)}</div>
        <div class="event-category">${getCategoryLabel(event.category)}</div>
        <button class="wishlist-heart ${isWished ? 'active' : ''}" onclick="event.stopPropagation();toggleWishlistCard(this,${event.id})" data-id="${event.id}" title="Save to wishlist">
          <i class="${isWished ? 'fas' : 'far'} fa-heart"></i>
        </button>
      </div>
      <div class="event-card-body">
        <h3>${event.title}</h3>
        <div class="event-meta">
          <div class="event-meta-item">
            <i class="fas fa-calendar"></i>
            <span>${formatDate(event.start_date || event.date)}</span>
          </div>
          <div class="event-meta-item">
            <i class="fas fa-map-marker-alt"></i>
            <span>${event.destination}</span>
          </div>
          <div class="event-meta-item">
            <i class="fas fa-users"></i>
            <span>${event.current_participants || 0}/${event.participant_limit || 0} spots filled</span>
          </div>
        </div>
      </div>
      <div class="event-card-footer">
        <div class="event-price">${formatCurrency(event.cost)} <span>/ person</span></div>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.location.href='event-detail.html?id=${event.id}'">
          ${event.status === 'open' ? 'View Details' : event.status === 'full' ? 'Waitlist' : 'View'}
        </button>
      </div>
    </div>
  `;
  }).join('');
}

/* ---------- Toast Notifications ---------- */
function showToast(message, type = 'info') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fas fa-check-circle',
    error: 'fas fa-times-circle',
    warning: 'fas fa-exclamation-triangle',
    info: 'fas fa-info-circle',
  };

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i class="${icons[type]}" style="font-size:1.2rem; color: var(--${type === 'error' ? 'danger' : type})"></i>
    <span style="flex:1">${message}</span>
    <button onclick="this.parentElement.remove()" style="background:none;color:var(--text-muted);font-size:1rem"><i class="fas fa-times"></i></button>
  `;

  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('show'));
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ---------- Modal Control ---------- */
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }
}

// Close modal on overlay click
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
    document.body.style.overflow = '';
  }
});

/* ---------- Sidebar Toggle (Mobile) ---------- */
function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    sidebar.classList.toggle('open');
  }
}

/* ---------- URL Params ---------- */
function getUrlParam(param) {
  const params = new URLSearchParams(window.location.search);
  return params.get(param);
}

/* ---------- Simple Form Validation ---------- */
function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return false;

  let valid = true;
  const inputs = form.querySelectorAll('[required]');

  inputs.forEach(input => {
    const error = input.parentElement.querySelector('.form-error');
    if (!input.value.trim()) {
      input.style.borderColor = 'var(--danger)';
      if (error) error.textContent = 'This field is required';
      valid = false;
    } else {
      input.style.borderColor = 'var(--border)';
      if (error) error.textContent = '';
    }
  });

  // Email validation
  const emailInput = form.querySelector('input[type="email"]');
  if (emailInput && emailInput.value && !emailInput.value.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
    emailInput.style.borderColor = 'var(--danger)';
    const error = emailInput.parentElement.querySelector('.form-error');
    if (error) error.textContent = 'Please enter a valid email';
    valid = false;
  }

  return valid;
}

/* ---------- Filter Events ---------- */
function filterEvents(events, filters) {
  return events.filter(event => {
    if (filters.category && filters.category !== 'all' && event.category !== filters.category) return false;
    if (filters.status && filters.status !== 'all' && event.status !== filters.status) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!event.title.toLowerCase().includes(q) && !event.destination.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

/* ---------- Counter Animation ---------- */
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.getAttribute('data-count'));
    const duration = 1500;
    const step = target / (duration / 16);
    let current = 0;

    const timer = setInterval(() => {
      current += step;
      if (current >= target) {
        current = target;
        clearInterval(timer);
      }
      el.textContent = Math.floor(current).toLocaleString();
    }, 16);
  });
}

/* ---------- Wishlist Card Toggle (global fallback) ---------- */
if (typeof toggleWishlistCard === 'undefined') {
  // For pages that don't define their own (e.g. index.html featured events)
  async function toggleWishlistCard(btn, eventId) {
    if (!Auth.isLoggedIn()) {
      showToast('Please log in to save events', 'warning');
      return;
    }
    try {
      var data = await WishlistAPI.toggle(eventId);
      var icon = btn.querySelector('i');
      if (data.inWishlist) {
        btn.classList.add('active');
        icon.className = 'fas fa-heart';
        showToast('Added to wishlist!', 'success');
      } else {
        btn.classList.remove('active');
        icon.className = 'far fa-heart';
        showToast('Removed from wishlist', 'info');
      }
    } catch (err) {
      showToast('Failed to update wishlist', 'error');
    }
  }
}
