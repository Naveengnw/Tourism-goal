const API_BASE = 'https://tourism-goal-production.up.railway.app/';

async function login() {
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  const res = await fetch(`${API_BASE}/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });

  const result = await res.json();
  if (result.success) {
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('dashboardSection').style.display = 'block';
    loadFeedback();
  } else {
    alert(result.message || 'Login failed');
  }
}

async function logout() {
  await fetch(`${API_BASE}/admin/logout`, { method: 'POST' });
  location.reload();
}

async function loadFeedback() {
  const res = await fetch(`${API_BASE}/admin/feedback`);
  const data = await res.json();
  const tbody = document.querySelector('#feedbackTable tbody');
  tbody.innerHTML = '';

  data.forEach(fb => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fb.id}</td>
      <td>${fb.name}</td>
      <td>${fb.comment}</td>
      <td>${fb.status}</td>
      <td>
        <select onchange="updateStatus(${fb.id}, this.value)">
          <option value="pending" ${fb.status==='pending'?'selected':''}>Pending</option>
          <option value="approved" ${fb.status==='approved'?'selected':''}>Approved</option>
          <option value="rejected" ${fb.status==='rejected'?'selected':''}>Rejected</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function updateStatus(id, status) {
  await fetch(`${API_BASE}/admin/feedback/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  loadFeedback();
}

function exportCSV() {
  window.location.href = `${API_BASE}/admin/export/csv`;
}

function exportPDF() {
  window.location.href = `${API_BASE}/admin/export/pdf`;
}