/* ─── ÉTOILE APP STATE ─────────────────────────────── */

const ETOILE = {
  version: '1.0.0',

  // Default state
  defaults: {
    pinterestUrl: '',
    pinterestImages: [],
    closetItems: [],
    mostWorn: [],
    wishlist: [],
    savedLooks: [],
    styleRequests: [],
    preferences: {
      sizes: { tops: '', bottoms: '', shoes: '', dresses: '' },
      budgetTier: 'medium',
      likedBrands: [],
      dislikedBrands: [],
      likedColors: [],
      dislikedColors: [],
      fitPreferences: [],
      wantToBuy: [],
    }
  },

  get(key) {
    try {
      const val = localStorage.getItem(`etoile_${key}`);
      return val ? JSON.parse(val) : this.defaults[key];
    } catch { return this.defaults[key]; }
  },

  set(key, value) {
    try { localStorage.setItem(`etoile_${key}`, JSON.stringify(value)); } catch {}
  },

  update(key, updater) {
    const current = this.get(key);
    this.set(key, updater(current));
  },

  addClosetItem(item) {
    this.update('closetItems', items => [...(items || []), { id: Date.now(), ...item }]);
  },

  toggleMostWorn(itemId) {
    const worn = this.get('mostWorn') || [];
    const idx = worn.indexOf(itemId);
    if (idx === -1) this.set('mostWorn', [...worn, itemId]);
    else this.set('mostWorn', worn.filter(id => id !== itemId));
  },

  saveLook(look) {
    this.update('savedLooks', looks => [...(looks || []), { id: Date.now(), savedAt: new Date().toISOString(), ...look }]);
  },

  addToWishlist(item) {
    const list = this.get('wishlist') || [];
    if (!list.find(i => i.id === item.id)) {
      this.set('wishlist', [...list, { ...item, addedAt: new Date().toISOString() }]);
    }
  },

  isOnboarded() {
    return !!(this.get('preferences')?.budgetTier && this.get('closetItems')?.length > 0);
  }
};

/* ─── UI UTILITIES ───────────────────────────────────── */

// Set active nav link based on current page
function setActiveNav() {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-links a').forEach(a => {
    const href = a.getAttribute('href');
    if (href === path || (path === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });
}

// Toggle button state
function initToggles() {
  document.querySelectorAll('[data-toggle]').forEach(btn => {
    btn.addEventListener('click', () => {
      const group = btn.dataset.toggleGroup;
      if (group) {
        document.querySelectorAll(`[data-toggle-group="${group}"]`).forEach(b => b.classList.remove('on', 'on-pink'));
      }
      btn.classList.toggle('on');
    });
  });
}

// Pill filter
function initPills() {
  document.querySelectorAll('.pill[data-filter]').forEach(pill => {
    pill.addEventListener('click', () => {
      const group = pill.dataset.filterGroup || 'default';
      document.querySelectorAll(`.pill[data-filter-group="${group}"]`).forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const filter = pill.dataset.filter;
      const target = pill.dataset.filterTarget;
      if (target) {
        document.querySelectorAll(`[data-category]`).forEach(item => {
          if (filter === 'all' || item.dataset.category === filter) {
            item.style.display = '';
          } else {
            item.style.display = 'none';
          }
        });
      }
    });
  });
}

// Category tile multi-select
function initCategoryTiles() {
  document.querySelectorAll('.category-tile').forEach(tile => {
    tile.addEventListener('click', () => tile.classList.toggle('selected'));
  });
}

// Price tier select
function initPriceTiers() {
  document.querySelectorAll('.price-option').forEach(opt => {
    opt.addEventListener('click', () => {
      document.querySelectorAll('.price-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });
}

// Color swatch select
function initSwatches() {
  document.querySelectorAll('.swatch[data-mode]').forEach(swatch => {
    swatch.addEventListener('click', () => swatch.classList.toggle('selected'));
  });
}

// Modal
function openModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.add('open');
}
function closeModal(id) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.classList.remove('open');
}
function initModals() {
  document.querySelectorAll('[data-modal-open]').forEach(btn => {
    btn.addEventListener('click', () => openModal(btn.dataset.modalOpen));
  });
  document.querySelectorAll('[data-modal-close]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.modalClose));
  });
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
}

// Animate on scroll
function initScrollAnimate() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('fade-up');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('[data-animate]').forEach(el => observer.observe(el));
}

// AI input — handle enter key and submit button
function initAiBar() {
  const bar = document.querySelector('.ai-bar input');
  const btn = document.querySelector('.ai-bar .btn');
  if (!bar) return;

  const submit = () => {
    const val = bar.value.trim();
    if (!val) return;
    ETOILE.update('styleRequests', reqs => [{ text: val, date: new Date().toISOString() }, ...(reqs || [])].slice(0, 10));
    window.location.href = `outfit-recommendations.html?q=${encodeURIComponent(val)}`;
  };

  bar.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
  if (btn) btn.addEventListener('click', submit);
}

// Wishlist heart toggle
function initWishlistBtns() {
  document.querySelectorAll('[data-wishlist]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      btn.classList.toggle('on-pink');
      const itemData = {
        id: btn.dataset.wishlist,
        name: btn.dataset.name || '',
        brand: btn.dataset.brand || '',
        price: btn.dataset.price || '',
      };
      if (btn.classList.contains('on-pink')) {
        ETOILE.addToWishlist(itemData);
      }
    });
  });
}

// Init all on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  initToggles();
  initPills();
  initCategoryTiles();
  initPriceTiers();
  initSwatches();
  initModals();
  initScrollAnimate();
  initAiBar();
  initWishlistBtns();
});

// Read query param
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name) || '';
}
