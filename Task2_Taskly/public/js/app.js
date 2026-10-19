/* Taskly - single page app */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ST = [['todo', 'To do', '#94A3B8'], ['prog', 'In progress', '#F59E0B'], ['rev', 'In review', '#8B5CF6'], ['done', 'Done', '#10B981']];
const PR = { high: ['High', '#EF4444'], med: ['Medium', '#F59E0B'], low: ['Low', '#10B981'] };
const LB = { Design: ['#9D174D', '#FCE7F3'], Backend: ['#075985', '#E0F2FE'], Frontend: ['#5B21B6', '#EDE9FE'], Bug: ['#991B1B', '#FEE2E2'], Docs: ['#334155', '#E2E8F0'], Research: ['#92400E', '#FEF3C7'], Content: ['#065F46', '#D1FAE5'] };
const SW = ['#4F46E5', '#0D9488', '#EA580C', '#DB2777', '#0284C7', '#7C3AED'];
const PAL = ['#E8590C', '#0284C7', '#059669', '#C026D3', '#7C3AED', '#DB2777', '#0D9488', '#4F46E5'];

const S = {
  token: localStorage.getItem('token'), user: JSON.parse(localStorage.getItem('user') || 'null'),
  projects: [], cur: null, tasks: [], notifs: [], unread: 0, users: [], cms: [], seen: new Set(),
  q: '', fm: null, adding: null, mode: null, open: null, bell: false, reg: false, drag: null,
  dr: { n: '', c: SW[0], m: [] }, err: ''
};
const P = () => S.projects.find(p => p.id === S.cur);
const hue = n => PAL[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
const av = (u, s = 26) => { const n = typeof u === 'string' ? u : u.username; return `<span class="av" title="${esc(n)}" style="width:${s}px;height:${s}px;font-size:${Math.round(s * .38)}px;background:${hue(n)}">${esc(n.slice(0, 2))}</span>`; };
const ago = d => { const s = (Date.now() - new Date(d)) / 1000; return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + 'm ago' : s < 86400 ? Math.floor(s / 3600) + 'h ago' : Math.floor(s / 86400) + 'd ago'; };
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const fmtDue = d => d ? new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'No date';

function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2600); }
async function api(path, method = 'GET', body) {
  const r = await fetch('/api' + path, { method, headers: { 'Content-Type': 'application/json', ...(S.token ? { Authorization: 'Bearer ' + S.token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const d = await r.json().catch(() => ({}));
  if (r.status === 401 && S.token) { logout(); throw new Error('Please log in again'); }
  if (!r.ok) throw new Error(d.message || 'Something went wrong');
  return d;
}

/* ---------- auth ---------- */
function rAuth() {
  const reg = S.reg;
  $('#auth').innerHTML = `<div class="hero"><div class="logo"><span><i class="ti ti-layout-kanban"></i></span><b>Taskly</b></div>
    <h2>Plan together. Ship faster.</h2><p>Create projects, assign tasks and talk it through in the card, all in one shared board.</p>
    <div class="mini"><div><b>To do</b><span>Design hero</span><span>API docs</span></div><div><b>In progress</b><span>Profile page</span></div><div><b>Done</b><span>Database schema</span></div></div></div>
    <div class="formp"><form class="fc" id="af"><h1>${reg ? 'Create your account' : 'Welcome back'}</h1><p class="sub">${reg ? 'Start organising work with your team.' : 'Log in to your workspace.'}</p>
    ${reg ? '<input name="username" placeholder="Username (3-20 characters)" minlength="3" maxlength="20" required>' : ''}
    <input name="email" type="email" placeholder="Email" required><input name="password" type="password" placeholder="Password" required>
    <div class="err" id="aerr"></div><button class="pri" type="submit">${reg ? 'Sign up' : 'Log in'}</button>
    <p class="sw">${reg ? 'Already have an account?' : 'New to Taskly?'} <a data-a="reg">${reg ? 'Log in' : 'Create an account'}</a></p>
    ${reg ? '' : '<p class="demo">Demo account: <b>ayesha_k@demo.com</b> / <b>password123</b></p>'}</form></div>`;
}
function showAuth() { $('#tk').classList.add('hidden'); $('#auth').classList.remove('hidden'); rAuth(); }
function logout() {
  localStorage.removeItem('token'); localStorage.removeItem('user');
  if (S.sock) S.sock.disconnect();
  Object.assign(S, { token: null, user: null, projects: [], tasks: [], cur: null, mode: null, open: null });
  showAuth();
}

/* ---------- data + realtime ---------- */
async function boot() {
  $('#auth').classList.add('hidden'); $('#tk').classList.remove('hidden');
  const [ps, nf] = await Promise.all([api('/projects'), api('/notifications')]);
  S.projects = ps; S.notifs = nf.items; S.unread = nf.unread;
  const last = localStorage.getItem('cur');
  S.cur = ps.find(p => p.id === last) ? last : (ps[0] && ps[0].id) || null;
  connect(); await loadTasks();
}
async function loadTasks() { S.tasks = S.cur ? await api(`/projects/${S.cur}/tasks`) : []; renderAll(); }
function upsert(t) {
  if (t.project !== S.cur) return;
  const i = S.tasks.findIndex(x => x.id === t.id);
  if (i >= 0) S.tasks[i] = t; else S.tasks.push(t);
  S.tasks.sort((a, b) => a.order - b.order); rHd(); rBd();
}
function connect() {
  if (S.sock) S.sock.disconnect();
  const s = S.sock = io({ auth: { token: S.token } });
  s.on('task:created', upsert);
  s.on('task:updated', upsert);
  s.on('task:deleted', ({ id, project }) => { if (project !== S.cur) return; S.tasks = S.tasks.filter(t => t.id !== id); if (S.open === id) shut(); rHd(); rBd(); });
  s.on('comment:created', ({ task, comment }) => {
    if (S.seen.has(comment.id)) return; S.seen.add(comment.id);
    const t = S.tasks.find(x => x.id === task); if (t) { t.commentsCount++; rBd(); }
    if (S.open === task && !S.cms.some(c => c.id === comment.id)) { S.cms.push(comment); rCms(); }
  });
  s.on('comment:deleted', ({ task, id }) => {
    const t = S.tasks.find(x => x.id === task); if (t && S.cms.some(c => c.id === id)) t.commentsCount = Math.max(0, t.commentsCount - 1);
    if (S.open === task) { S.cms = S.cms.filter(c => c.id !== id); rCms(); } rBd();
  });
  s.on('notification', n => { S.notifs.unshift(n); S.unread++; rHd(); toast(`${n.actor} ${n.text}`); });
  s.on('project:added', p => { if (!S.projects.some(x => x.id === p.id)) { S.projects.push(p); rSb(); } });
  s.on('project:updated', p => { const i = S.projects.findIndex(x => x.id === p.id); if (i >= 0) S.projects[i] = p; rSb(); if (p.id === S.cur) { if (S.fm && !p.members.some(m => m.id === S.fm)) S.fm = null; loadTasks(); if (S.mode === 'mem') rMd(); } });
  const gone = ({ id }) => { S.projects = S.projects.filter(p => p.id !== id); if (S.cur === id) { S.cur = S.projects[0] ? S.projects[0].id : null; shut(); loadTasks(); toast('A project you were in is no longer available'); } else rSb(); };
  s.on('project:removed', gone); s.on('project:deleted', gone);
}

/* ---------- render ---------- */
function renderAll() { rSb(); rHd(); rBd(); }
function rSb() {
  $('#sb').innerHTML = `<div class="logo"><span><i class="ti ti-layout-kanban"></i></span><b>Taskly</b></div>
    <button class="nv" data-a="mine"><i class="ti ti-checkbox"></i><span>My tasks</span></button><button class="nv" data-a="bell"><i class="ti ti-inbox"></i><span>Inbox${S.unread ? ' (' + S.unread + ')' : ''}</span></button>
    <div class="lbl">PROJECTS</div>${S.projects.map(p => `<button class="pj ${p.id === S.cur ? 'on' : ''}" data-a="proj" data-id="${p.id}"><i class="sq" style="background:${p.color}"></i><span>${esc(p.name)}</span></button>`).join('')}
    <button class="pj" data-a="np" style="color:var(--ind)"><i class="ti ti-plus"></i><span>New project</span></button>
    <div class="me">${av(S.user, 32)}<div style="flex:1"><b>${esc(S.user.username)}</b><small>${P() && P().owner === S.user.id ? 'Owner' : 'Member'}</small></div><button class="ib" data-a="logout" title="Log out" style="width:30px;height:30px"><i class="ti ti-logout"></i></button></div>`;
}
const vis = () => S.tasks.filter(t => (!S.q || t.title.toLowerCase().includes(S.q)) && (!S.fm || (t.assignee && t.assignee.id === S.fm)));
function rHd() {
  const p = P(), k = S.tasks, d = k.filter(t => t.status === 'done').length, pct = k.length ? Math.round(d / k.length * 100) : 0;
  const bell = `<div class="bw"><button class="ib" data-a="bell" aria-label="Notifications"><i class="ti ti-bell"></i>${S.unread ? `<i class="badge">${S.unread}</i>` : ''}</button>${S.bell ? `<div class="np"><div class="nh">Notifications</div>${S.notifs.length ? S.notifs.map(n => `<div class="ni ${n.read ? '' : 'new'}" data-a="nf" data-p="${n.project || ''}" data-t="${n.task || ''}">${av(n.actor || '?', 28)}<div><b>${esc(n.actor)}</b> ${esc(n.text)}<small>${ago(n.createdAt)}</small></div></div>`).join('') : '<div class="ni">No notifications yet</div>'}</div>` : ''}</div>`;
  if (!p) { $('#hd').innerHTML = `<div class="h1"><h1>Welcome to Taskly</h1><span class="grow"></span>${bell}</div>`; return; }
  $('#hd').innerHTML = `<div class="h1"><i class="dotc" style="background:${p.color}"></i><h1>${esc(p.name)}</h1><span class="grow"></span>${bell}<button class="pri" data-a="newtask"><i class="ti ti-plus"></i>New task</button></div>
    <div class="prog"><div class="bar"><i style="width:${pct}%"></i></div>${k.length ? `${d} of ${k.length} tasks done · ${pct}%` : 'No tasks yet. Add your first task below.'}</div>
    <div class="tool"><div class="srch"><i class="ti ti-search" style="color:#9CA3AF"></i><input id="q" value="${esc(S.q)}" placeholder="Search tasks"></div>
    <div class="stack">${p.members.map(m => `<span data-a="fm" data-id="${m.id}" style="opacity:${!S.fm || S.fm === m.id ? 1 : .35}">${av(m, 30)}</span>`).join('')}</div>${S.fm ? '<span class="lnk" data-a="clr">Clear filter</span>' : ''}
    <button class="sec" data-a="mem"><i class="ti ti-user-plus"></i>Members (${p.members.length})</button></div>`;
}
function card(t) {
  const [lc, lb] = LB[t.label] || LB.Docs, dn = t.status === 'done', od = t.due && t.due < today() && !dn;
  return `<div class="card ${S.open === t.id && S.mode === 'task' ? 'sel' : ''}" draggable="true" data-a="card" data-id="${t.id}">
    <div class="ct"><span class="chip" style="background:${lb};color:${lc}">${esc(t.label)}</span><i class="ti ti-flag-3" title="${PR[t.priority][0]} priority" style="color:${PR[t.priority][1]};font-size:16px"></i></div>
    <div class="ttl ${dn ? 'dn' : ''}">${esc(t.title)}</div>
    <div class="cf"><span class="${od ? 'od' : ''}"><i class="ti ti-calendar"></i>${fmtDue(t.due)}</span><span><i class="ti ti-message-circle"></i>${t.commentsCount}</span><span class="r">${t.assignee ? av(t.assignee, 26) : '<i class="ti ti-user-question" title="Unassigned" style="font-size:20px;color:#9CA3AF"></i>'}</span></div></div>`;
}
function rBd() {
  if (!P()) { $('#bd').innerHTML = `<div class="welcome"><i class="ti ti-layout-kanban"></i><h2>Create your first project</h2><p>Projects hold your board, tasks and team. Start one and invite people to join.</p><button class="pri" data-a="np"><i class="ti ti-plus"></i>New project</button></div>`; return; }
  $('#bd').innerHTML = ST.map(([k, n, c]) => { const L = vis().filter(t => t.status === k);
    return `<div class="col" data-s="${k}"><div class="ch"><i style="background:${c}"></i>${n}<span class="cnt">${L.length}</span></div><div class="lst">${L.map(card).join('')}${S.adding === k ? '<input id="ni" placeholder="Task title, then Enter">' : ''}${!L.length && S.adding !== k ? '<div class="empty">Drop tasks here</div>' : ''}</div><button class="addb" data-a="add" data-s="${k}"><i class="ti ti-plus"></i>Add task</button></div>`; }).join('');
}
const cmHTML = c => `<div class="cm">${av(c.author, 28)}<div class="b"><b>${esc(c.author.username)}</b><small>${ago(c.createdAt)}</small>${c.isMine || c.author.id === S.user.id ? ` <button class="lnk" data-a="delcm" data-id="${c.id}" style="font-size:11px;color:#9CA3AF">delete</button>` : ''}<p>${esc(c.text)}</p></div></div>`;
function rCms() { const l = $('#cl'); if (l) { l.innerHTML = S.cms.map(cmHTML).join('') || '<div style="color:#9CA3AF;margin-bottom:8px">No comments yet.</div>'; $('#cc').textContent = S.cms.length; } }
const head = t => `<div class="mh">${t}<button class="ib" data-a="close" style="margin-left:auto" aria-label="Close"><i class="ti ti-x"></i></button></div>`;
function rMd() {
  $('#ov').classList.toggle('hidden', !S.mode); const M = $('#md'); if (!S.mode) { M.innerHTML = ''; return; }
  const p = P();
  if (S.mode === 'task') {
    const t = S.tasks.find(x => x.id === S.open); if (!t) return shut();
    const sel = (id, o, v) => `<select id="${id}">${o.map(([a, b]) => `<option value="${a}" ${String(a) === String(v) ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select>`;
    const row = (l, c) => `<div class="fr"><span>${l}</span>${c}</div>`;
    M.innerHTML = head(`<span style="font-weight:400;color:var(--mu);font-size:12px">${esc(p.name)} / TSK-${t.id.slice(-4)}</span>`) + `<div class="mb"><input id="dt" class="dt" value="${esc(t.title)}">
      ${row('Status', sel('ds', ST.map(s => [s[0], s[1]]), t.status))}${row('Assignee', sel('da', [['', 'Unassigned'], ...p.members.map(m => [m.id, m.username])], t.assignee ? t.assignee.id : ''))}
      ${row('Priority', sel('dp', [['high', 'High'], ['med', 'Medium'], ['low', 'Low']], t.priority))}${row('Label', sel('dl', Object.keys(LB).map(l => [l, l]), t.label))}${row('Due date', `<input id="dd" type="date" value="${esc(t.due)}">`)}
      <div class="h3">Description</div><textarea id="dx" style="width:100%;min-height:70px" placeholder="Add more detail">${esc(t.description)}</textarea>
      <div class="h3">Comments (<span id="cc">${S.cms.length}</span>)</div><div id="cl"></div>
      <div class="row2"><input id="dc" placeholder="Write a comment" style="flex:1" maxlength="500"><button class="pri" data-a="send">Send</button></div>
      <div style="margin-top:18px"><button class="danger" data-a="deltask"><i class="ti ti-trash"></i> Delete task</button></div></div>`;
    rCms();
  }
  if (S.mode === 'mem') {
    const out = S.users.filter(u => !p.members.some(m => m.id === u.id)), owner = p.owner === S.user.id;
    M.innerHTML = head('Project members') + `<div class="mb"><p style="color:var(--mu);margin-bottom:6px">Only members can see this project and be assigned tasks.</p>
      ${p.members.map(m => `<div class="mr">${av(m, 34)}<div class="b"><b>${esc(m.username)}</b><small>${m.id === p.owner ? 'Owner' : 'Member'}</small></div>${owner && m.id !== p.owner ? `<button class="sec" data-a="rm" data-id="${m.id}">Remove</button>` : ''}</div>`).join('')}
      <div class="h3">Invite someone</div>${out.length ? `<div class="row2"><select id="inv" style="flex:1">${out.map(u => `<option value="${u.id}">${esc(u.username)}</option>`).join('')}</select><button class="pri" data-a="inv">Invite</button></div>` : '<p style="color:var(--mu)">Everyone is already on this project.</p>'}
      ${owner ? '<div style="margin-top:20px"><button class="danger" data-a="delproj"><i class="ti ti-trash"></i> Delete project</button></div>' : ''}</div>`;
  }
  if (S.mode === 'np') {
    M.innerHTML = head('Create a project') + `<div class="mb"><div style="color:var(--mu);margin-bottom:6px">Project name</div><input id="pn" value="${esc(S.dr.n)}" placeholder="Summer campaign" maxlength="60" style="width:100%"><div class="err">${esc(S.err)}</div>
      <div style="color:var(--mu);margin:10px 0 8px">Colour</div><div class="row2" style="gap:10px">${SW.map(c => `<button class="swb ${c === S.dr.c ? 'on' : ''}" data-a="pc" data-c="${c}" style="background:${c}" aria-label="Colour"></button>`).join('')}</div>
      <div style="color:var(--mu);margin:16px 0 4px">Add team members</div>${S.users.filter(u => u.id !== S.user.id).map(u => `<label class="mr" style="cursor:pointer"><input type="checkbox" data-a="pm" data-id="${u.id}" ${S.dr.m.includes(u.id) ? 'checked' : ''} style="height:auto">${av(u, 26)}<span>${esc(u.username)}</span></label>`).join('')}
      <div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="pri" data-a="create">Create project</button></div></div>`;
  }
}
const shut = () => { S.mode = null; S.open = null; S.err = ''; rMd(); rBd(); };
async function openTask(id) { S.open = id; S.mode = 'task'; S.cms = []; rMd(); rBd(); try { S.cms = await api(`/tasks/${id}/comments`); S.cms.forEach(c => S.seen.add(c.id)); rCms(); } catch (e) { toast(e.message); } }
async function patch(id, body) { try { upsert(await api('/tasks/' + id, 'PATCH', body)); } catch (e) { toast(e.message); loadTasks(); } }
async function switchProject(id) { S.cur = id; localStorage.setItem('cur', id); S.fm = null; S.q = ''; S.adding = null; S.mode = null; S.open = null; await loadTasks(); rMd(); }

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  const el = e.target.closest('[data-a]');
  if (S.bell && !e.target.closest('.bw')) { S.bell = false; rHd(); }
  if (!el) return;
  const a = el.dataset.a, id = el.dataset.id;
  try {
    if (a === 'ovl') { if (e.target === el) shut(); return; }
    if (a === 'reg') { S.reg = !S.reg; rAuth(); }
    if (a === 'logout') logout();
    if (a === 'proj') await switchProject(id);
    if (a === 'mine') { S.fm = S.user.id; rHd(); rBd(); }
    if (a === 'fm') { S.fm = S.fm === id ? null : id; rHd(); rBd(); }
    if (a === 'clr') { S.fm = null; rHd(); rBd(); }
    if (a === 'bell') {
      S.bell = !S.bell; rHd();
      if (S.bell && S.unread) { S.unread = 0; S.notifs.forEach(n => n.read = true); api('/notifications/read', 'POST').catch(() => {}); setTimeout(() => { rSb(); rHd(); }, 0); }
    }
    if (a === 'nf') {
      S.bell = false; rHd();
      if (el.dataset.p && el.dataset.p !== S.cur && S.projects.some(p => p.id === el.dataset.p)) await switchProject(el.dataset.p);
      if (el.dataset.t && S.tasks.some(t => t.id === el.dataset.t)) openTask(el.dataset.t);
    }
    if (a === 'add') { S.adding = el.dataset.s; rBd(); $('#ni').focus(); }
    if (a === 'card') openTask(id);
    if (a === 'close') shut();
    if (a === 'newtask') { const t = await api(`/projects/${S.cur}/tasks`, 'POST', { title: 'Untitled task', assignee: S.user.id }); upsert(t); await openTask(t.id); $('#dt').select(); }
    if (a === 'send') {
      const i = $('#dc'), text = i.value.trim(); if (!text) return;
      const c = await api(`/tasks/${S.open}/comments`, 'POST', { text }); S.seen.add(c.id);
      S.cms.push(c); const t = S.tasks.find(x => x.id === S.open); if (t) t.commentsCount++; i.value = ''; rCms(); rBd();
    }
    if (a === 'delcm') { await api(`/tasks/${S.open}/comments/${id}`, 'DELETE'); S.cms = S.cms.filter(c => c.id !== id); const t = S.tasks.find(x => x.id === S.open); if (t) t.commentsCount = Math.max(0, t.commentsCount - 1); rCms(); rBd(); }
    if (a === 'deltask') { if (!confirm('Delete this task?')) return; await api('/tasks/' + S.open, 'DELETE'); S.tasks = S.tasks.filter(t => t.id !== S.open); shut(); rHd(); }
    if (a === 'mem') { S.users = await api('/users'); S.mode = 'mem'; rMd(); }
    if (a === 'inv') { const p = await api(`/projects/${S.cur}/members`, 'POST', { userId: $('#inv').value }); S.projects[S.projects.findIndex(x => x.id === p.id)] = p; rMd(); rHd(); toast('Member invited'); }
    if (a === 'rm') { const p = await api(`/projects/${S.cur}/members/${id}`, 'DELETE'); S.projects[S.projects.findIndex(x => x.id === p.id)] = p; if (S.fm === id) S.fm = null; await loadTasks(); rMd(); toast('Member removed'); }
    if (a === 'delproj') { if (!confirm('Delete this project and all its tasks?')) return; await api('/projects/' + S.cur, 'DELETE'); S.projects = S.projects.filter(p => p.id !== S.cur); S.cur = S.projects[0] ? S.projects[0].id : null; shut(); await loadTasks(); toast('Project deleted'); }
    if (a === 'np') { S.users = await api('/users'); S.dr = { n: '', c: SW[0], m: [] }; S.err = ''; S.mode = 'np'; rMd(); $('#pn').focus(); }
    if (a === 'pc') { S.dr.c = el.dataset.c; rMd(); }
    if (a === 'pm') S.dr.m = el.checked ? [...S.dr.m, id] : S.dr.m.filter(x => x !== id);
    if (a === 'create') {
      if (!S.dr.n.trim()) { S.err = 'Enter a project name'; rMd(); return; }
      const p = await api('/projects', 'POST', { name: S.dr.n, color: S.dr.c, members: S.dr.m });
      S.projects.push(p); shut(); await switchProject(p.id); toast('Project created');
    }
  } catch (err) { toast(err.message); }
});
document.addEventListener('submit', async e => {
  if (e.target.id !== 'af') return; e.preventDefault();
  $('#aerr').textContent = '';
  try {
    const r = await api(S.reg ? '/auth/register' : '/auth/login', 'POST', Object.fromEntries(new FormData(e.target)));
    S.token = r.token; S.user = r.user; localStorage.setItem('token', r.token); localStorage.setItem('user', JSON.stringify(r.user)); await boot();
  } catch (err) { $('#aerr').textContent = err.message; }
});
document.addEventListener('input', e => {
  if (e.target.id === 'q') { S.q = e.target.value.toLowerCase(); rBd(); }
  if (e.target.id === 'pn') { S.dr.n = e.target.value; if (S.err) { S.err = ''; e.target.nextElementSibling.textContent = ''; } }
});
document.addEventListener('change', e => {
  const map = { dt: 'title', ds: 'status', da: 'assignee', dp: 'priority', dl: 'label', dd: 'due', dx: 'description' };
  const f = map[e.target.id]; if (!f || S.mode !== 'task') return;
  let v = e.target.value; if (f === 'assignee') v = v || null; if (f === 'title' && !v.trim()) { toast('Title cannot be empty'); return rMd(); }
  patch(S.open, { [f]: v });
});
document.addEventListener('keydown', e => {
  const id = e.target.id;
  if (id === 'ni') {
    const v = e.target.value.trim();
    if (e.key === 'Enter' && v) { const st = S.adding; S.adding = null; api(`/projects/${S.cur}/tasks`, 'POST', { title: v, status: st }).then(upsert).catch(err => { toast(err.message); rBd(); }); }
    if (e.key === 'Escape') { S.adding = null; rBd(); }
  }
  if (id === 'dc' && e.key === 'Enter') document.querySelector('[data-a="send"]').click();
  if (id === 'pn' && e.key === 'Enter') document.querySelector('[data-a="create"]').click();
  if (e.key === 'Escape' && S.mode) shut();
});
document.addEventListener('focusout', e => { if (e.target.id === 'ni' && S.adding) { S.adding = null; rBd(); } });

/* drag and drop between columns */
document.addEventListener('dragstart', e => { const c = e.target.closest('.card'); if (!c) return; S.drag = c.dataset.id; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', S.drag); c.style.opacity = '.4'; });
document.addEventListener('dragover', e => { const c = e.target.closest('.col'); if (!c || !S.drag) return; e.preventDefault(); document.querySelectorAll('.col').forEach(x => x.classList.toggle('over', x === c)); });
document.addEventListener('drop', e => {
  const c = e.target.closest('.col'); if (!c || !S.drag) return; e.preventDefault();
  const t = S.tasks.find(x => x.id === S.drag), id = S.drag; S.drag = null;
  if (t && t.status !== c.dataset.s) { t.status = c.dataset.s; t.order = Date.now(); S.tasks.sort((a, b) => a.order - b.order); rHd(); patch(id, { status: c.dataset.s }); }
  rBd();
});
document.addEventListener('dragend', () => { S.drag = null; rBd(); });

/* start */
if (S.token && S.user) boot().catch(() => logout()); else showAuth();
