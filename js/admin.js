/* ============================================
   JU BOARD — admin.js
   Page Gestion des comptes : liste, création,
   suppression. Réservé aux comptes admin.
   ============================================ */

function renderUsers(users) {
  const list = document.getElementById('users-list');
  if (users.length === 0) {
    list.innerHTML = '<p style="color: var(--text3); font-size: 13px;">Aucun compte.</p>';
    return;
  }
  list.innerHTML = users.map((u) => `
    <div class="card earnings-item">
      <div class="earnings-item-left">
        <span class="earnings-company">${u.displayName} ${u.isAdmin ? '· Admin' : ''}</span>
        <span class="earnings-date">@${u.username}</span>
      </div>
      ${u.username !== 'admin' ? `<button class="btn-expand" data-username="${u.username}" data-action="delete-user">Supprimer</button>` : ''}
    </div>`).join('');

  list.querySelectorAll('[data-action="delete-user"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Supprimer le compte @${btn.dataset.username} ?`)) return;
      try {
        await deleteUser(btn.dataset.username);
        showToast('Compte supprimé');
        loadUsers();
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
