// ─────────────────────────────────────────────────────────────────
// Local-only auth + data — no Supabase required.
// Everything persists in localStorage in this browser.
// ─────────────────────────────────────────────────────────────────

// ── Auth helpers ──────────────────────────────────────────────────
function _lsGet(k, fallback) {
  try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; }
}
function _lsSet(k, v) { localStorage.setItem(k, JSON.stringify(v)); }

function getUser() {
  return Promise.resolve(_lsGet('etoile_session', null));
}
function getSession() { return getUser(); }

function signUp(email, password, name) {
  const users = _lsGet('etoile_users', []);
  if (users.find(u => u.email === email)) return Promise.reject(new Error('Email already registered.'));
  const user = { id: 'u_' + Date.now(), email, name, password };
  users.push(user);
  _lsSet('etoile_users', users);
  const session = { id: user.id, email, name };
  _lsSet('etoile_session', session);
  return Promise.resolve({ user: session });
}

function signIn(email, password) {
  const users = _lsGet('etoile_users', []);
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return Promise.reject(new Error('Invalid email or password.'));
  const session = { id: user.id, email: user.email, name: user.name };
  _lsSet('etoile_session', session);
  return Promise.resolve({ user: session });
}

function signOut() {
  localStorage.removeItem('etoile_session');
  window.location.href = 'auth.html';
  return Promise.resolve();
}

async function requireAuth() {
  const user = await getUser();
  if (!user) {
    const dest = window.location.pathname.split('/').pop();
    window.location.href = 'auth.html?redirect=' + encodeURIComponent(dest);
    return null;
  }
  return user;
}

// ── Database operations (all localStorage) ────────────────────────
const DB = {

  // ── Preferences ────────────────────────────────────────────────
  getPrefs(userId) {
    return Promise.resolve(_lsGet('etoile_prefs_' + userId, {}));
  },
  savePrefs(userId, prefs) {
    const existing = _lsGet('etoile_prefs_' + userId, {});
    _lsSet('etoile_prefs_' + userId, { ...existing, ...prefs, updated_at: new Date().toISOString() });
    return Promise.resolve();
  },

  // ── Closet ──────────────────────────────────────────────────────
  getClosetItems(userId) {
    return Promise.resolve(_lsGet('etoile_closet_' + userId, []));
  },
  addClosetItem(userId, item) {
    const items = _lsGet('etoile_closet_' + userId, []);
    const newItem = { ...item, id: 'ci_' + Date.now(), user_id: userId, created_at: new Date().toISOString() };
    items.unshift(newItem);
    _lsSet('etoile_closet_' + userId, items);
    return Promise.resolve(newItem);
  },
  updateClosetItem(id, updates) {
    const user = _lsGet('etoile_session', null);
    if (!user) return Promise.resolve();
    const items = _lsGet('etoile_closet_' + user.id, []);
    const idx = items.findIndex(i => i.id === id);
    if (idx !== -1) { items[idx] = { ...items[idx], ...updates }; _lsSet('etoile_closet_' + user.id, items); }
    return Promise.resolve();
  },
  removeClosetItem(id) {
    const user = _lsGet('etoile_session', null);
    if (!user) return Promise.resolve();
    const items = _lsGet('etoile_closet_' + user.id, []).filter(i => i.id !== id);
    _lsSet('etoile_closet_' + user.id, items);
    return Promise.resolve();
  },
  uploadClosetPhoto(userId, file) {
    // Convert to base64 data URL for local storage
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => resolve(e.target.result);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  },

  // ── Saved Looks ─────────────────────────────────────────────────
  getSavedLooks(userId) {
    return Promise.resolve(_lsGet('etoile_looks_' + userId, []));
  },
  saveLook(userId, look) {
    const looks = _lsGet('etoile_looks_' + userId, []);
    if (looks.find(l => l.look_key === look.id)) return Promise.resolve();
    const entry = { ...look, look_key: look.id, id: 'lk_' + Date.now(), user_id: userId };
    looks.unshift(entry);
    _lsSet('etoile_looks_' + userId, looks);
    return Promise.resolve(entry);
  },
  removeLook(id) {
    const user = _lsGet('etoile_session', null);
    if (!user) return Promise.resolve();
    const looks = _lsGet('etoile_looks_' + user.id, []).filter(l => l.id !== id);
    _lsSet('etoile_looks_' + user.id, looks);
    return Promise.resolve();
  },

  // ── Wishlist ─────────────────────────────────────────────────────
  getWishlist(userId) {
    return Promise.resolve(_lsGet('etoile_wishlist_' + userId, []));
  },
  addToWishlist(userId, item) {
    const list = _lsGet('etoile_wishlist_' + userId, []);
    const entry = { ...item, id: 'wl_' + Date.now(), user_id: userId, created_at: new Date().toISOString() };
    list.unshift(entry);
    _lsSet('etoile_wishlist_' + userId, list);
    return Promise.resolve(entry);
  },
  removeFromWishlist(id) {
    const user = _lsGet('etoile_session', null);
    if (!user) return Promise.resolve();
    const list = _lsGet('etoile_wishlist_' + user.id, []).filter(i => i.id !== id);
    _lsSet('etoile_wishlist_' + user.id, list);
    return Promise.resolve();
  },
};
