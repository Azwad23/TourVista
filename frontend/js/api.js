// =============================================
// TourVista API Service Layer
// Replaces mock data with real MySQL-backed API calls
// =============================================
// Always use relative path since frontend is served by the same Express server
const API_BASE = '/api';

// ==================== AUTH HELPERS ====================
const Auth = {
  getToken() {
    return localStorage.getItem('tourvista_token');
  },

  setToken(token) {
    localStorage.setItem('tourvista_token', token);
  },

  getUser() {
    const user = localStorage.getItem('tourvista_user');
    return user ? JSON.parse(user) : null;
  },

  setUser(user) {
    localStorage.setItem('tourvista_user', JSON.stringify(user));
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  isAdmin() {
    const user = this.getUser();
    return user && user.role === 'admin';
  },

  logout() {
    localStorage.removeItem('tourvista_token');
    localStorage.removeItem('tourvista_user');
    // Navigate to login relative to current page
    if (window.location.pathname.includes('/admin/')) {
      window.location.href = '../login.html';
    } else {
      window.location.href = 'login.html';
    }
  },

  // Get Authorization header
  headers(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }
};

// ==================== GENERIC FETCH WRAPPER ====================
async function apiCall(endpoint, options = {}) {
  var url = API_BASE + endpoint;
  var fetchOptions = {
    headers: Auth.headers(),
    method: options.method || 'GET'
  };
  if (options.body) fetchOptions.body = options.body;

  try {
    var res = await fetch(url, fetchOptions);
    var text = await res.text();
    var data;
    try { data = JSON.parse(text); } catch(e) { data = null; }

    if (!res.ok) {
      // Only auto-logout on 401 for non-auth endpoints
      if (res.status === 401 && !endpoint.startsWith('/auth/')) {
        Auth.logout();
        return null;
      }
      throw new Error((data && (data.error || (data.errors && data.errors[0] && data.errors[0].msg))) || 'Request failed (' + res.status + ')');
    }

    return data;
  } catch (err) {
    console.error('API Error [' + endpoint + ']:', err.message);
    throw err;
  }
}

// ==================== AUTH API ====================
const AuthAPI = {
  async login(email, password) {
    const data = await apiCall('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    if (data) {
      Auth.setToken(data.token);
      Auth.setUser(data.user);
    }
    return data;
  },

  async register(formData) {
    const data = await apiCall('/auth/register', {
      method: 'POST',
      body: JSON.stringify(formData)
    });
    if (data) {
      Auth.setToken(data.token);
      Auth.setUser(data.user);
    }
    return data;
  },

  async getMe() {
    return apiCall('/auth/me');
  }
};

// ==================== EVENTS API ====================
const EventsAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/events${query ? '?' + query : ''}`);
  },

  async getById(id) {
    return apiCall(`/events/${id}`);
  },

  async create(eventData, imageFile) {
    if (imageFile) {
      // Use FormData for file upload
      const formData = new FormData();
      formData.append('image', imageFile);
      Object.keys(eventData).forEach(key => {
        if (eventData[key] !== null && eventData[key] !== undefined) {
          if (typeof eventData[key] === 'object') {
            formData.append(key, JSON.stringify(eventData[key]));
          } else {
            formData.append(key, eventData[key]);
          }
        }
      });
      const url = API_BASE + '/events';
      const headers = {};
      const token = Auth.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(url, { method: 'POST', headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create event');
      return data;
    }
    return apiCall('/events', {
      method: 'POST',
      body: JSON.stringify(eventData)
    });
  },

  async update(id, eventData, imageFile) {
    if (imageFile) {
      const formData = new FormData();
      formData.append('image', imageFile);
      Object.keys(eventData).forEach(key => {
        if (eventData[key] !== null && eventData[key] !== undefined) {
          if (typeof eventData[key] === 'object') {
            formData.append(key, JSON.stringify(eventData[key]));
          } else {
            formData.append(key, eventData[key]);
          }
        }
      });
      const url = API_BASE + '/events/' + id;
      const headers = {};
      const token = Auth.getToken();
      if (token) headers['Authorization'] = 'Bearer ' + token;
      const res = await fetch(url, { method: 'PUT', headers, body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update event');
      return data;
    }
    return apiCall(`/events/${id}`, {
      method: 'PUT',
      body: JSON.stringify(eventData)
    });
  },

  async delete(id) {
    return apiCall(`/events/${id}`, { method: 'DELETE' });
  },

  async uploadImage(id, file) {
    const formData = new FormData();
    formData.append('image', file);
    const url = API_BASE + '/events/' + id + '/image';
    const headers = {};
    const token = Auth.getToken();
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const res = await fetch(url, { method: 'POST', headers, body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to upload image');
    return data;
  },

  async deleteImage(id) {
    return apiCall(`/events/${id}/image`, { method: 'DELETE' });
  },

  async getStats() {
    return apiCall('/events/admin/stats');
  }
};

// ==================== REGISTRATIONS API ====================
// ==================== PAYMENTS API ====================
const PaymentsAPI = {
  async submit(paymentData) {
    return apiCall('/payments/submit', {
      method: 'POST',
      body: JSON.stringify(paymentData)
    });
  },

  async getMy() {
    return apiCall('/payments/my');
  },

  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/payments/all${query ? '?' + query : ''}`);
  },

  async getById(id) {
    return apiCall(`/payments/${id}`);
  },

  async verify(id, adminNotes) {
    return apiCall(`/payments/${id}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ admin_notes: adminNotes })
    });
  },

  async reject(id, adminNotes) {
    return apiCall(`/payments/${id}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ admin_notes: adminNotes })
    });
  }
};

const RegistrationsAPI = {
  async register(eventId, data = {}) {
    return apiCall('/registrations', {
      method: 'POST',
      body: JSON.stringify({ event_id: eventId, ...data })
    });
  },

  async checkStatus(eventId) {
    return apiCall(`/registrations/check/${eventId}`);
  },

  async getMy(status = 'all') {
    const query = status !== 'all' ? `?status=${status}` : '';
    return apiCall(`/registrations/my${query}`);
  },

  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/registrations/all${query ? '?' + query : ''}`);
  },

  async approve(id) {
    return apiCall(`/registrations/${id}/approve`, { method: 'PUT' });
  },

  async reject(id) {
    return apiCall(`/registrations/${id}/reject`, { method: 'PUT' });
  },

  async cancel(id) {
    return apiCall(`/registrations/${id}`, { method: 'DELETE' });
  }
};

// ==================== USERS API ====================
const UsersAPI = {
  async getAll(params = {}) {
    const query = new URLSearchParams(params).toString();
    return apiCall(`/users${query ? '?' + query : ''}`);
  },

  async getById(id) {
    return apiCall(`/users/${id}`);
  },

  async toggleStatus(id) {
    return apiCall(`/users/${id}/toggle-status`, { method: 'PUT' });
  },

  async updateProfile(data) {
    return apiCall('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async changePassword(currentPassword, newPassword) {
    return apiCall('/users/change-password', {
      method: 'PUT',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
    });
  },

  async uploadProfilePicture(file) {
    const formData = new FormData();
    formData.append('profile_picture', file);
    const url = API_BASE + '/users/profile-picture';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + Auth.getToken() },
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');
    return data;
  },

  async deleteProfilePicture() {
    return apiCall('/users/profile-picture', { method: 'DELETE' });
  }
};

// ==================== CHATBOT API ====================
const ChatbotAPI = {
  async sendMessage(message, sessionId) {
    return apiCall('/chatbot/message', {
      method: 'POST',
      body: JSON.stringify({ message, session_id: sessionId })
    });
  },

  async getConversation(sessionId) {
    return apiCall(`/chatbot/conversation/${sessionId}`);
  },

  async getAllConversations() {
    return apiCall('/chatbot/conversations');
  },

  async getConversationDetail(id) {
    return apiCall(`/chatbot/conversations/${id}`);
  }
};

// ==================== UTILITY FUNCTIONS ====================
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  });
}

function formatCurrency(amount) {
  return '৳' + Number(amount).toLocaleString('en-BD');
}

function getStatusBadge(status) {
  const map = {
    approved: '<span class="badge badge-success">Approved</span>',
    pending: '<span class="badge badge-warning">Pending</span>',
    rejected: '<span class="badge badge-danger">Rejected</span>',
    waitlisted: '<span class="badge badge-info">Waitlisted</span>',
    active: '<span class="badge badge-success">Active</span>',
    inactive: '<span class="badge badge-danger">Inactive</span>',
    open: '<span class="badge badge-success">Open</span>',
    closed: '<span class="badge badge-danger">Closed</span>',
    full: '<span class="badge badge-warning">Full</span>',
    cancelled: '<span class="badge badge-neutral">Cancelled</span>',
    paid: '<span class="badge badge-success">Paid</span>',
    unpaid: '<span class="badge badge-warning">Unpaid</span>',
    refunded: '<span class="badge badge-info">Refunded</span>'
  };
  return map[status] || `<span class="badge badge-neutral">${status}</span>`;
}

function getCategoryLabel(cat) {
  const map = { tour: '🏛️ Tour', trek: '🏔️ Trek', cycling: '🚴 Cycling', outing: '🏖️ Outing' };
  return map[cat] || cat;
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==================== WISHLIST API ====================
const WishlistAPI = {
  async getAll() {
    return apiCall('/wishlist');
  },

  async check(eventId) {
    return apiCall('/wishlist/check/' + eventId);
  },

  async checkBulk(eventIds) {
    return apiCall('/wishlist/check-bulk', {
      method: 'POST',
      body: JSON.stringify({ eventIds })
    });
  },

  async add(eventId) {
    return apiCall('/wishlist/' + eventId, { method: 'POST' });
  },

  async remove(eventId) {
    return apiCall('/wishlist/' + eventId, { method: 'DELETE' });
  },

  async toggle(eventId) {
    return apiCall('/wishlist/' + eventId + '/toggle', { method: 'POST' });
  },

  async clearAll() {
    return apiCall('/wishlist', { method: 'DELETE' });
  },

  async count() {
    return apiCall('/wishlist/count');
  }
};

// ==================== EVENT IMAGE HELPER ====================
function getEventImageUrl(imageUrl) {
  if (!imageUrl) return '';
  return imageUrl;
}

function getEventImageHtml(event, height) {
  height = height || 200;
  if (event && event.image_url) {
    var url = getEventImageUrl(event.image_url);
    return '<img src="' + url + '" alt="' + (event.title || 'Event') + '" style="width:100%;height:' + height + 'px;object-fit:cover;display:block;">';
  }
  // Fallback to gradient + icon
  var gradient = event.gradient || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
  var icon = event.icon || 'fas fa-map-marked-alt';
  return '<div class="placeholder-img" style="' + gradient + ';width:100%;height:' + height + 'px;display:flex;align-items:center;justify-content:center;"><i class="' + icon + '" style="font-size:3rem;color:rgba(255,255,255,0.7);"></i></div>';
}

// ==================== AVATAR HELPER ====================
function getAvatarUrl(picturePath) {
  if (!picturePath) return '';
  return picturePath;
}

function getAvatarHtml(user, size, fontSize) {
  size = size || 42;
  fontSize = fontSize || '1rem';
  if (user && user.profile_picture) {
    var url = getAvatarUrl(user.profile_picture);
    return '<img src="' + url + '" alt="Avatar" style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;object-fit:cover;display:block;">';
  }
  var initials = (user && user.avatar) ? user.avatar : (user ? (user.first_name[0] + user.last_name[0]).toUpperCase() : '--');
  return '<div style="width:' + size + 'px;height:' + size + 'px;border-radius:50%;background:linear-gradient(135deg,var(--primary),#7c3aed);display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:' + fontSize + ';flex-shrink:0;">' + initials + '</div>';
}

// ==================== NAV UPDATER ====================
// Note: Main nav auth state is handled by initAuthNav() in app.js
function updateNavForUser() {
  const user = Auth.getUser();
  if (!user) return;

  // Update any user display areas on the page (sidebar, etc.)
  document.querySelectorAll('.sidebar-avatar').forEach(el => {
    el.innerHTML = getAvatarHtml(user, 42, '1rem');
  });
  document.querySelectorAll('.sidebar-user-info h4').forEach(el => {
    el.textContent = `${user.first_name} ${user.last_name}`;
  });
  document.querySelectorAll('.sidebar-user-info p').forEach(el => {
    el.textContent = user.role === 'admin' ? 'Administrator' : 'Participant';
  });
}

// Run on page load
document.addEventListener('DOMContentLoaded', updateNavForUser);
