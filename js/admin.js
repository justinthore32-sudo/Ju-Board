/* ============================================
   JU BOARD — admin.js
   Page Gestion des comptes : liste, activité,
   permissions par page, création, suppression.
   Réservé aux comptes admin.
   ============================================ */

const PERMISSION_LABELS = { news: 'News', analyse: 'Analyse', recherche: 'Recherche', assistant: 'Assistant' };

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function renderUsers(users) {
  const list = document.getElementById('users-list');
  if (users.length === 0) {
    list.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Aucun compte.</p>';
    return;
  }

  list.innerHTML = users.map((u) => `
    <div class="card" style="display:flex; flex-direction:column; gap:12px;" data-username="${u.username}">
      <div class="earnings-item-left">
        <span class="earnings-company">${u.displayName} ${u.isAdmin ? '· Admin' : ''}</span>
        <span class="earnings-date">@${u.username} · créé le ${formatDate(u.createdAt)}</span>
      </div>

      <div style="font-size:12px; color:var(--text3); display:flex; flex-direction:column; gap:2px;">
        <span>Dernière connexion : ${formatDate(u.lastLoginAt)}</span>
        <span>Dernière activité : ${formatDate(u.lastSeenAt)}</span>
        <span>Durée de la dernière session : ${u.lastSessionDuration || '—'}</span>
      </div>

      ${!u.isAdmin ? `
      <div>
        <div class="deep-block-title" style="margin-bottom:6px;">Accès autorisés</div>
        <div style="display:flex; flex-wrap:wrap; gap:12px;">
          ${Object.entries(PERMISSION_LABELS).map(([key, label]) => `
            <label style="display:flex; align-items:center; gap:6px; font-size:13px; color:var(--text2);">
              <input type="checkbox" class="perm-checkbox" data-perm="${key}" ${u.permissions?.[key] !== false ? 'checked' : ''}>
              ${label}
            </label>`).join('')}
        </div>
      </div>` : ''}

      <div style="display:flex; gap:10px;">
        ${!u.isAdmin ? `<button class="btn-expand" data-action="save-perms">Enregistrer les accès</button>` : ''}
        ${u.username !== 'admin' ? `<button class="btn-expand" data-action="delete-user" style="color:var(--red);">Supprimer</button>` : ''}
      </div>
    </div>`).join('');

  list.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const username = btn.closest('[data-username]').dataset.username;
      if (!confirm(`Supprimer le compte @${username} ?`)) return;
      try {
        await deleteUser(username);
        showToast('Compte supprimé');
        loadUsers();
      } catch (err) {
        showToast(err.message);
      }
    });
  });

  list.querySelectorAll('[data-action="save-perms"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const card = btn.closest('[data-username]');
      const username = card.dataset.username;
      const permissions = {};
      card.querySelectorAll('.perm-checkbox').forEach((cb) => {
        permissions[cb.dataset.perm] = cb.checked;
      });
      try {
        await updateUserPermissions(username, permissions);
        showToast('Accès mis à jour');
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

async function loadUsers() {
  try {
    const data = await fetchUsers();
    renderUsers(data.users || []);
  } catch (err) {
    document.getElementById('users-list').innerHTML = `<p style="color: var(--red); font-size: 13px;">${err.message}</p>`;
  }
}

function initCreateUserForm() {
  const form = document.getElementById('create-user-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('new-username').value.trim();
    const displayName = document.getElementById('new-displayname').value.trim();
    const password = document.getElementById('new-password').value;
    const isAdmin = document.getElementById('new-isadmin').checked;
    const errorEl = document.getElementById('create-user-error');
    errorEl.classList.add('hidden');

    try {
      await createUser(username, password, displayName, isAdmin);
      showToast('Compte créé');
      form.reset();
      loadUsers();
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  const user = getCurrentUser();
  if (!user || !user.isAdmin) {
    window.location.href = 'index.html';
    return;
  }
  loadUsers();
  initCreateUserForm();
});
