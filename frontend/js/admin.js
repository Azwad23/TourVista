/* ============================================
   Admin Panel Logic — API-Backed
   ============================================ */

document.addEventListener('DOMContentLoaded', function () {
  initAdminPage();
});

function initAdminPage() {
  const page = document.body.getAttribute('data-page');

  // Load shared UI for ALL admin pages (pending count, user info, notif dot)
  loadAdminSharedUI();

  switch (page) {
    case 'admin-dashboard':
      renderAdminDashboard();
      break;
    case 'admin-events':
      renderAdminEvents();
      break;
    case 'admin-approvals':
      renderAdminApprovals();
      break;
    case 'admin-users':
      renderAdminUsers();
      break;
    case 'admin-chatbot':
      renderAdminChatbot();
      break;
    case 'admin-settings':
    case 'admin-notifications':
      // These pages handle their own rendering
      break;
  }
}

/* ---------- Shared Admin UI (sidebar + header) ---------- */
async function loadAdminSharedUI() {
  // 1) Update sidebar + header user info from Auth
  var user = Auth.getUser();
  if (user) {
    var fullName = (user.first_name || '') + ' ' + (user.last_name || '');
    var initials = ((user.first_name || '?')[0] + (user.last_name || '?')[0]).toUpperCase();

    // Sidebar avatar + name
    document.querySelectorAll('.admin-sidebar-avatar').forEach(function(el) {
      if (user.avatar_url) {
        el.innerHTML = '<img src="' + getAvatarUrl(user.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" alt="">';
        el.style.overflow = 'hidden';
      } else {
        el.textContent = initials;
      }
    });
    document.querySelectorAll('.admin-sidebar-name').forEach(function(el) {
      el.textContent = fullName.trim() || 'Admin';
    });

    // Header avatar + name
    document.querySelectorAll('.admin-header-avatar').forEach(function(el) {
      if (user.avatar_url) {
        el.innerHTML = '<img src="' + getAvatarUrl(user.avatar_url) + '" style="width:100%;height:100%;object-fit:cover;" alt="">';
      } else {
        el.style.background = 'linear-gradient(135deg,var(--primary),#7c3aed)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.color = 'white';
        el.style.fontWeight = '700';
        el.style.fontSize = '0.8rem';
        el.textContent = initials;
      }
    });
    document.querySelectorAll('.admin-header-name').forEach(function(el) {
      el.textContent = fullName.trim() || 'Admin';
    });
  }

  // 2) Fetch pending approvals count from API and update badges + notification dot
  try {
    var data = await EventsAPI.getStats();
    var pending = (data.stats && data.stats.pendingApprovals) || 0;

    // Update all sidebar pending badges
    document.querySelectorAll('.admin-pending-badge').forEach(function(badge) {
      badge.textContent = pending;
      badge.style.display = pending > 0 ? '' : 'none';
    });

    // Update notification dot in header bell
    document.querySelectorAll('.admin-notif-dot').forEach(function(dot) {
      dot.style.display = pending > 0 ? 'block' : 'none';
    });
  } catch (err) {
    console.error('Failed to load admin pending count:', err);
  }
}

/* ---------- Admin Dashboard ---------- */
async function renderAdminDashboard() {
  try {
    const data = await EventsAPI.getStats();
    const stats = data.stats;

    // Update stat card numbers
    const statCards = document.querySelectorAll('.stat-card h3');
    if (statCards.length >= 4) {
      statCards[0].textContent = stats.totalUsers;
      statCards[1].textContent = stats.totalEvents;
      statCards[2].textContent = stats.totalRegistrations;
      statCards[3].textContent = stats.pendingApprovals;
    }

    renderBarChart(data.monthlyRegistrations || []);
    renderCategoryBreakdown(data.categories || []);
    await renderRecentRegistrations();
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

function renderBarChart(monthlyData) {
  const container = document.getElementById('barChart');
  if (!container) return;

  if (monthlyData.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px;">No registration data yet</p>';
    return;
  }

  const maxCount = Math.max(...monthlyData.map(d => d.count));

  container.innerHTML = monthlyData.map(d => `
    <div class="bar" style="height:${(d.count / maxCount) * 100}%">
      <div class="bar-value">${d.count}</div>
      <div class="bar-label">${d.month}</div>
    </div>
  `).join('');
}

function renderCategoryBreakdown(categories) {
  const container = document.getElementById('categoryBreakdown');
  if (!container) return;

  const total = categories.reduce((sum, c) => sum + c.count, 0) || 1;
  const colors = { tour: 'var(--primary)', trek: 'var(--success)', cycling: '#f59e0b', outing: '#ec4899' };

  container.innerHTML = categories.map(c => `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:0.85rem;font-weight:500;text-transform:capitalize;">${c.category}</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">${c.count}</span>
      </div>
      <div class="progress">
        <div class="progress-bar" style="width:${(c.count / total) * 100}%;background:${colors[c.category] || 'var(--primary)'};"></div>
      </div>
    </div>
  `).join('');
}

async function renderRecentRegistrations() {
  const container = document.getElementById('recentRegistrations');
  if (!container) return;

  try {
    const data = await RegistrationsAPI.getAll();
    const recent = (data.registrations || []).slice(0, 5);

    container.innerHTML = recent.map(reg => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="avatar">${reg.avatar || '?'}</div>
            <div>
              <div class="name">${reg.first_name} ${reg.last_name}</div>
              <div class="email">${reg.email}</div>
            </div>
          </div>
        </td>
        <td>${reg.event_title ? reg.event_title.substring(0, 30) + '...' : 'N/A'}</td>
        <td>${formatDate(reg.registered_at)}</td>
        <td>${getStatusBadge(reg.status)}</td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = '<tr><td colspan="4">Failed to load registrations</td></tr>';
  }
}

/* ---------- Admin Events ---------- */
async function renderAdminEvents() {
  await renderAdminEventTable();
}

async function renderAdminEventTable(filter = 'all') {
  const container = document.getElementById('adminEventsTable');
  if (!container) return;

  try {
    const params = {};
    if (filter !== 'all') params.status = filter;
    const data = await EventsAPI.getAll(params);
    const events = data.events || [];

    container.innerHTML = events.map(event => `
      <tr>
        <td>
          <div class="user-cell">
            ${event.image_url
              ? '<img src="' + getEventImageUrl(event.image_url) + '" alt="" style="width:36px;height:36px;border-radius:8px;object-fit:cover;">'
              : '<div class="avatar" style="' + event.gradient + '; color:white;"><i class="' + event.icon + '" style="font-size:0.7rem"></i></div>'
            }
            <div>
              <div class="name">${event.title.substring(0, 35)}${event.title.length > 35 ? '...' : ''}</div>
              <div class="email">${getCategoryLabel(event.category)}</div>
            </div>
          </div>
        </td>
        <td>${formatDate(event.start_date)}</td>
        <td>${(event.destination || 'TBA').substring(0, 25)}</td>
        <td>${formatCurrency(event.cost)}</td>
        <td>${event.current_participants}/${event.participant_limit}</td>
        <td>${getStatusBadge(event.status)}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm" onclick="editEvent(${event.id})" title="Edit"><i class="fas fa-edit"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="deleteEvent(${event.id})" title="Delete" style="color:var(--danger)"><i class="fas fa-trash"></i></button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = '<tr><td colspan="7">Failed to load events</td></tr>';
  }
}

async function editEvent(id) {
  try {
    const data = await EventsAPI.getById(id);
    const event = data.event;

    document.getElementById('eventFormTitle').textContent = 'Edit Event';
    document.getElementById('eventTitle').value = event.title;
    document.getElementById('eventDescription').value = event.description || '';
    document.getElementById('eventCategory').value = event.category;
    document.getElementById('eventStartDate').value = event.start_date ? event.start_date.substring(0, 10) : '';
    document.getElementById('eventEndDate').value = event.end_date ? event.end_date.substring(0, 10) : '';
    document.getElementById('eventCost').value = event.cost;
    document.getElementById('eventLimit').value = event.participant_limit;
    document.getElementById('eventStatus').value = event.status;

    // New fields
    var destEl = document.getElementById('eventDestination');
    if (destEl) destEl.value = event.destination || '';
    var mpEl = document.getElementById('eventMeetingPoint');
    if (mpEl) mpEl.value = event.meeting_point || '';
    var diffEl = document.getElementById('eventDifficulty');
    if (diffEl) diffEl.value = event.difficulty || 'moderate';

    // Event image
    if (typeof resetEventImagePicker === 'function') resetEventImagePicker();
    if (event.image_url && typeof showExistingEventImage === 'function') {
      showExistingEventImage(event.image_url);
    }

    // Store edit ID
    document.getElementById('eventModal').setAttribute('data-edit-id', id);
    openModal('eventModal');
  } catch (err) {
    showToast('Failed to load event', 'error');
  }
}

async function deleteEvent(id) {
  if (!confirm('Are you sure you want to delete this event?')) return;

  try {
    await EventsAPI.delete(id);
    showToast('Event deleted successfully', 'success');
    await renderAdminEventTable();
  } catch (err) {
    showToast(err.message || 'Delete failed', 'error');
  }
}

async function saveEvent() {
  const title = document.getElementById('eventTitle').value;
  if (!title) {
    showToast('Please fill in the event title', 'error');
    return;
  }

  const startDate = document.getElementById('eventStartDate') ? document.getElementById('eventStartDate').value : '';
  const endDate = document.getElementById('eventEndDate') ? document.getElementById('eventEndDate').value : '';
  const destEl = document.getElementById('eventDestination');
  const mpEl = document.getElementById('eventMeetingPoint');
  const diffEl = document.getElementById('eventDifficulty');

  const eventData = {
    title,
    description: document.getElementById('eventDescription').value,
    category: document.getElementById('eventCategory').value,
    start_date: startDate,
    end_date: endDate || startDate, // fallback to start date
    cost: parseFloat(document.getElementById('eventCost').value) || 0,
    participant_limit: parseInt(document.getElementById('eventLimit').value) || 20,
    status: document.getElementById('eventStatus').value,
    destination: destEl ? destEl.value : '',
    meeting_point: mpEl ? mpEl.value : '',
    difficulty: diffEl ? diffEl.value : 'moderate'
  };

  const editId = document.getElementById('eventModal').getAttribute('data-edit-id');

  // Check if user explicitly removed the image
  const picker = document.getElementById('eventImagePicker');
  if (picker && picker.getAttribute('data-removed') === 'true' && !selectedEventImage) {
    eventData.remove_image = 'true';
  }

  // Get selected image file (if any)
  var imageFile = (typeof selectedEventImage !== 'undefined') ? selectedEventImage : null;

  try {
    if (editId) {
      await EventsAPI.update(editId, eventData, imageFile);
      showToast('Event updated!', 'success');
    } else {
      await EventsAPI.create(eventData, imageFile);
      showToast('Event created!', 'success');
    }

    closeModal('eventModal');
    document.getElementById('eventModal').removeAttribute('data-edit-id');
    if (typeof resetEventImagePicker === 'function') resetEventImagePicker();
    await renderAdminEventTable();
  } catch (err) {
    showToast(err.message || 'Save failed', 'error');
  }
}

/* ---------- Admin Approvals ---------- */
async function renderAdminApprovals() {
  await renderApprovalTable();
}

async function renderApprovalTable(filter = 'all') {
  const container = document.getElementById('approvalsTable');
  if (!container) return;

  try {
    const params = {};
    if (filter !== 'all') params.status = filter;
    const data = await RegistrationsAPI.getAll(params);
    const regs = data.registrations || [];
    const counts = data.counts || {};

    // Update stat cards if present
    const statCards = document.querySelectorAll('.stat-card h3');
    if (statCards.length >= 3) {
      statCards[0].textContent = counts.pending || 0;
      statCards[1].textContent = counts.approved || 0;
      statCards[2].textContent = counts.rejected || 0;
    }

    container.innerHTML = regs.map(reg => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="avatar">${reg.avatar || '?'}</div>
            <div>
              <div class="name">${reg.first_name || ''} ${reg.last_name || ''}</div>
              <div class="email">${reg.email || ''}</div>
            </div>
          </div>
        </td>
        <td>${reg.event_title ? reg.event_title.substring(0, 30) + '...' : 'N/A'}</td>
        <td>${formatDate(reg.registered_at)}</td>
        <td>${getStatusBadge(reg.status)}</td>
        <td>
          ${reg.status === 'pending' ? `
            <div class="approval-row">
              <button class="btn btn-success btn-sm" onclick="approveRegistration(${reg.id})">
                <i class="fas fa-check"></i> Approve
              </button>
              <button class="btn btn-danger btn-sm" onclick="rejectRegistration(${reg.id})">
                <i class="fas fa-times"></i> Reject
              </button>
            </div>
          ` : `
            <span style="color:var(--text-muted); font-size:0.85rem">—</span>
          `}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = '<tr><td colspan="5">Failed to load approvals</td></tr>';
  }
}

async function approveRegistration(id) {
  try {
    await RegistrationsAPI.approve(id);
    showToast('Registration approved!', 'success');
    await renderApprovalTable();
  } catch (err) {
    showToast(err.message || 'Approval failed', 'error');
  }
}

async function rejectRegistration(id) {
  try {
    await RegistrationsAPI.reject(id);
    showToast('Registration rejected', 'warning');
    await renderApprovalTable();
  } catch (err) {
    showToast(err.message || 'Rejection failed', 'error');
  }
}

/* ---------- Admin Users ---------- */
async function renderAdminUsers() {
  await renderUserTable();
}

async function renderUserTable(filter = 'all') {
  const container = document.getElementById('usersTable');
  if (!container) return;

  try {
    const params = {};
    if (filter !== 'all') params.role = filter;
    const data = await UsersAPI.getAll(params);
    const users = data.users || [];
    const counts = data.counts || {};

    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card h3');
    if (statCards.length >= 3) {
      statCards[0].textContent = counts.total || 0;
      statCards[1].textContent = counts.active || 0;
      statCards[2].textContent = counts.admins || 0;
    }

    container.innerHTML = users.map(user => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="avatar">${user.avatar || '?'}</div>
            <div>
              <div class="name">${user.first_name} ${user.last_name}</div>
              <div class="email">${user.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${user.role === 'admin' ? 'badge-info' : 'badge-neutral'}">${user.role}</span></td>
        <td>${getStatusBadge(user.status)}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm" title="View"><i class="fas fa-eye"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="toggleUserStatus(${user.id})" title="Toggle Status">
              <i class="fas fa-${user.status === 'active' ? 'ban' : 'check-circle'}" style="color:${user.status === 'active' ? 'var(--danger)' : 'var(--success)'}"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    container.innerHTML = '<tr><td colspan="5">Failed to load users</td></tr>';
  }
}

async function toggleUserStatus(id) {
  try {
    const data = await UsersAPI.toggleStatus(id);
    showToast(`User ${data.status === 'active' ? 'activated' : 'deactivated'}`, 'success');
    await renderUserTable();
  } catch (err) {
    showToast(err.message || 'Failed to toggle status', 'error');
  }
}

function searchUsers(query) {
  renderUserTableSearch(query);
}

async function renderUserTableSearch(query) {
  const container = document.getElementById('usersTable');
  if (!container) return;

  try {
    const data = await UsersAPI.getAll({ search: query });
    const users = data.users || [];

    container.innerHTML = users.map(user => `
      <tr>
        <td>
          <div class="user-cell">
            <div class="avatar">${user.avatar || '?'}</div>
            <div>
              <div class="name">${user.first_name} ${user.last_name}</div>
              <div class="email">${user.email}</div>
            </div>
          </div>
        </td>
        <td><span class="badge ${user.role === 'admin' ? 'badge-info' : 'badge-neutral'}">${user.role}</span></td>
        <td>${getStatusBadge(user.status)}</td>
        <td>${formatDate(user.created_at)}</td>
        <td>
          <div class="flex gap-1">
            <button class="btn btn-ghost btn-sm" title="View"><i class="fas fa-eye"></i></button>
            <button class="btn btn-ghost btn-sm" onclick="toggleUserStatus(${user.id})" title="Toggle Status">
              <i class="fas fa-${user.status === 'active' ? 'ban' : 'check-circle'}" style="color:${user.status === 'active' ? 'var(--danger)' : 'var(--success)'}"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Search users error:', err);
  }
}

/* ---------- Admin Chatbot Monitoring ---------- */
async function renderAdminChatbot() {
  try {
    const data = await ChatbotAPI.getAllConversations();
    const conversations = data.conversations || [];
    const topQuestions = data.topQuestions || [];
    const stats = data.stats || {};

    // Update stat cards
    const statCards = document.querySelectorAll('.stat-card h3');
    if (statCards.length >= 4) {
      statCards[0].textContent = stats.total_conversations || 0;
      statCards[1].textContent = stats.total_messages || 0;
    }

    renderConversationList(conversations);
    renderTopQuestions(topQuestions);
  } catch (err) {
    console.error('Chatbot monitoring error:', err);
  }
}

function renderConversationList(conversations) {
  const container = document.getElementById('conversationList');
  if (!container) return;

  if (conversations.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No conversations yet</p>';
    return;
  }

  container.innerHTML = conversations.map(conv => `
    <div class="conversation-card" onclick="viewConversation(${conv.id})" style="padding:12px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.2s;" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div class="user-cell">
          <div class="avatar">${conv.avatar || (conv.first_name ? conv.first_name[0] + (conv.last_name || '')[0] : '?')}</div>
          <div>
            <div class="name">${conv.first_name ? conv.first_name + ' ' + conv.last_name : 'Guest'}</div>
            <div class="email">${conv.message_count} messages</div>
          </div>
        </div>
        <span style="font-size:0.8rem;color:var(--text-muted)">${formatDate(conv.started_at)}</span>
      </div>
      <div style="font-size:0.85rem;color:var(--text-light);margin-top:8px;padding-left:44px;">${conv.last_message ? conv.last_message.substring(0, 60) + '...' : ''}</div>
    </div>
  `).join('');
}

function renderTopQuestions(questions) {
  const container = document.getElementById('topQuestions');
  if (!container) return;

  if (questions.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;">No questions recorded yet</p>';
    return;
  }

  const maxCount = Math.max(...questions.map(q => q.count));

  container.innerHTML = questions.map(q => `
    <div style="margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
        <span style="font-size:0.85rem;font-weight:500;">${q.message.substring(0, 40)}${q.message.length > 40 ? '...' : ''}</span>
        <span style="font-size:0.8rem;color:var(--text-muted)">${q.count}</span>
      </div>
      <div class="progress">
        <div class="progress-bar" style="width:${(q.count / maxCount) * 100}%;background:var(--primary);"></div>
      </div>
    </div>
  `).join('');
}

async function viewConversation(id) {
  try {
    const data = await ChatbotAPI.getConversationDetail(id);
    const messages = data.messages || [];

    const detail = document.getElementById('conversationDetail');
    if (detail) {
      detail.innerHTML = messages.map(msg => `
        <div style="display:flex;gap:10px;margin-bottom:16px;${msg.sender === 'user' ? 'flex-direction:row-reverse;' : ''}">
          <div style="width:32px;height:32px;border-radius:50%;background:${msg.sender === 'bot' ? 'var(--primary)' : 'var(--success)'};display:flex;align-items:center;justify-content:center;color:white;font-size:0.75rem;flex-shrink:0;">
            <i class="fas fa-${msg.sender === 'bot' ? 'robot' : 'user'}"></i>
          </div>
          <div style="background:${msg.sender === 'bot' ? 'var(--bg)' : 'var(--primary-light)'};padding:10px 14px;border-radius:12px;max-width:70%;font-size:0.9rem;">
            ${msg.message}
            <div style="font-size:0.7rem;color:var(--text-muted);margin-top:4px;">${formatDate(msg.sent_at)}</div>
          </div>
        </div>
      `).join('');
    }
    openModal('conversationModal');
  } catch (err) {
    showToast('Failed to load conversation', 'error');
  }
}

/* ---------- Admin Filter Helpers ---------- */
function filterAdminEvents(status) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  renderAdminEventTable(status);
}

function filterApprovals(status) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  renderApprovalTable(status);
}

function filterUsers(role) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
  event.target.classList.add('active');
  renderUserTable(role);
}
