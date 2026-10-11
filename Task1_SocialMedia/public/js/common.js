const $ = s => document.querySelector(s);
const token = () => localStorage.getItem('token');
const me = () => JSON.parse(localStorage.getItem('user') || 'null');

function logout() { localStorage.clear(); location.href = 'login.html'; }
function requireLogin() { if (!token() || !me()) logout(); }

async function api(path, method = 'GET', body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: 'Bearer ' + token() } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token()) logout();
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function timeAgo(d) {
  const s = Math.floor((Date.now() - new Date(d)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(d).toLocaleDateString();
}

/* ---------- Navbar + user search ---------- */
function renderNav(active) {
  const u = me();
  $('#nav').innerHTML = `
    <div class="nav-inner">
      <a href="index.html" class="brand">Connect</a>
      <div class="search">
        <input id="searchInput" placeholder="Search users" autocomplete="off" />
        <div id="searchResults" class="results hidden"></div>
      </div>
      <a href="index.html" class="${active === 'home' ? 'on' : ''}">Home</a>
      <a href="profile.html?u=${encodeURIComponent(u.username)}" class="${active === 'profile' ? 'on' : ''}">Profile</a>
      <button class="btn-link" id="logoutBtn">Logout</button>
    </div>`;
  $('#logoutBtn').onclick = logout;

  let timer;
  const box = $('#searchResults');
  $('#searchInput').addEventListener('input', e => {
    clearTimeout(timer);
    const q = e.target.value.trim();
    if (!q) return box.classList.add('hidden');
    timer = setTimeout(async () => {
      try {
        const users = await api('/users/search?q=' + encodeURIComponent(q));
        box.innerHTML = users.length
          ? users.map(x => `<a href="profile.html?u=${encodeURIComponent(x.username)}">@${esc(x.username)}<small>${esc(x.bio || '')}</small></a>`).join('')
          : '<a>No users found</a>';
        box.classList.remove('hidden');
      } catch {}
    }, 250);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) box.classList.add('hidden'); });
}

/* ---------- Post card ---------- */
function postHTML(p) {
  return `
  <article class="post" data-id="${p.id}">
    <div class="avatar">${esc(p.author.username[0])}</div>
    <div class="post-body">
      <div class="post-head">
        <a href="profile.html?u=${encodeURIComponent(p.author.username)}">@${esc(p.author.username)}</a>
        <span class="time">${timeAgo(p.createdAt)}</span>
        ${p.isMine ? '<button class="del" data-act="delpost">Delete</button>' : ''}
      </div>
      <p class="post-text">${esc(p.content)}</p>
      <div class="post-actions">
        <button class="act like ${p.liked ? 'liked' : ''}" data-act="like">${p.liked ? '♥' : '♡'} <span>${p.likesCount}</span></button>
        <button class="act" data-act="comments">💬 <span class="ccount">${p.commentsCount}</span></button>
      </div>
      <div class="comments hidden" data-loaded="0">
        <div class="comment-list"></div>
        <div class="comment-form">
          <input placeholder="Write a comment..." maxlength="300" />
          <button class="btn" data-act="addcomment">Reply</button>
        </div>
      </div>
    </div>
  </article>`;
}

const commentHTML = c => `
  <div class="comment" data-cid="${c.id}">
    <b>@${esc(c.author.username)}</b><span>${esc(c.text)}</span>
    ${c.isMine ? '<button class="del" data-act="delcomment">✕</button>' : ''}
  </div>`;

/* Handles like / comment / delete clicks for every post inside `container` */
function bindPosts(container) {
  container.addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const post = btn.closest('.post');
    const id = post.dataset.id;
    const act = btn.dataset.act;
    const ccount = post.querySelector('.ccount');

    try {
      if (act === 'like') {
        const r = await api(`/posts/${id}/like`, 'POST');
        btn.classList.toggle('liked', r.liked);
        btn.innerHTML = `${r.liked ? '♥' : '♡'} <span>${r.likesCount}</span>`;
      }

      if (act === 'delpost') {
        if (!confirm('Delete this post?')) return;
        await api(`/posts/${id}`, 'DELETE');
        post.remove();
      }

      if (act === 'comments') {
        const box = post.querySelector('.comments');
        box.classList.toggle('hidden');
        if (box.dataset.loaded === '0') {
          const list = await api(`/posts/${id}/comments`);
          box.querySelector('.comment-list').innerHTML = list.map(commentHTML).join('');
          box.dataset.loaded = '1';
        }
      }

      if (act === 'addcomment') {
        const input = post.querySelector('.comment-form input');
        const text = input.value.trim();
        if (!text) return;
        const c = await api(`/posts/${id}/comments`, 'POST', { text });
        post.querySelector('.comment-list').insertAdjacentHTML('beforeend', commentHTML(c));
        input.value = '';
        ccount.textContent = +ccount.textContent + 1;
      }

      if (act === 'delcomment') {
        const row = btn.closest('.comment');
        await api(`/posts/${id}/comments/${row.dataset.cid}`, 'DELETE');
        row.remove();
        ccount.textContent = Math.max(0, +ccount.textContent - 1);
      }
    } catch (err) { alert(err.message); }
  });

  // Press Enter in a comment box to send
  container.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.comment-form input'))
      e.target.closest('.comment-form').querySelector('[data-act="addcomment"]').click();
  });
}
