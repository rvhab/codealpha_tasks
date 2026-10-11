/* Buzz – single page app. Uses helpers from common.js: $, api, me, esc, timeAgo, logout, requireLogin */
requireLogin();
const ME = me();
const view = $('#view');
const $$ = s => [...document.querySelectorAll(s)];
let tab = 'all', pg = 1, MP = null, pendingImg = null, sv = null, pendingAv = null, storyDraft = null;

/* ---------- helpers ---------- */
const PAL = ['#F5516C', '#5B5BD6', '#12A594', '#E08A00', '#D6409F', '#2F80ED', '#8E4EC6'];
const hue = n => PAL[[...n].reduce((a, c) => a + c.charCodeAt(0), 0) % PAL.length];
window.avFail = i => {
  const d = document.createElement('div');
  d.className = 'av ini';
  d.style.cssText = i.style.cssText + ';background:' + hue(i.alt);
  d.textContent = (i.alt[0] || '?').toUpperCase();
  i.replaceWith(d);
};
const DEMO = ['ayesha_k', 'bilal_dev', 'sara_m', 'omar_s', 'zainab_a', 'hamza_r', 'maryam_art', 'daniyal_t'];
const AV = {};
const learn = d => {
  if (!d || typeof d !== 'object') return;
  if (Array.isArray(d)) return d.forEach(learn);
  if (d.username && 'avatar' in d) AV[d.username] = d.avatar;
  if (d.author) learn(d.author);
};
const rawApi = api;
api = async (...a) => { const d = await rawApi(...a); learn(d); return d; };
const avSrc = n => (n in AV) ? AV[n] : (DEMO.includes(n) ? `https://i.pravatar.cc/150?u=${encodeURIComponent(n)}` : '');
const av = (n, s = 40) => {
  const src = avSrc(n);
  return src
    ? `<img class="av" alt="${esc(n)}" style="width:${s}px;height:${s}px" src="${esc(src)}" onerror="avFail(this)">`
    : `<div class="av ini" style="width:${s}px;height:${s}px;font-size:${Math.round(s / 2.4)}px;background:${hue(n)}">${esc((n[0] || '?').toUpperCase())}</div>`;
};
const avl = (n, s) => `<a href="#/u/${encodeURIComponent(n)}">${av(n, s)}</a>`;
const saved = () => JSON.parse(localStorage.getItem('saved') || '[]');
const folBtn = (id, on) => id === ME.id ? '' : `<button class="fol ${on ? 'on' : 'off'}" data-a="fol" data-id="${id}">${on ? 'Following' : 'Follow'}</button>`;
const setFol = (b, on) => { b.className = 'fol ' + (on ? 'on' : 'off'); b.textContent = on ? 'Following' : 'Follow'; };
function toast(m) {
  const t = $('#toast'); t.textContent = m; t.classList.add('on');
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ---------- dummy stories & notifications ---------- */
const sp = s => `https://picsum.photos/seed/${s}/600/1000`;
const STORIES = {
  ayesha_k: [{ img: sp('design1'), q: 'Good design is invisible.' }, { bg: '#F2674B', q: 'Coffee first, pixels second.' }],
  bilal_dev: [{ bg: '#4F46E5', q: 'Ship it, then make it better.' }, { img: sp('code2'), q: 'Node, Mongo and late-night coffee.' }],
  sara_m: [{ img: sp('sunsetsea'), q: 'Chasing light, always.' }, { img: sp('hills3'), q: 'The mountains are calling.' }],
  omar_s: [{ img: sp('gym4'), q: 'Discipline beats motivation.' }],
  zainab_a: [{ bg: '#D6409F', q: 'A reader lives a thousand lives.' }, { img: sp('tea5'), q: 'Tea, rain and a good book.' }],
  hamza_r: [{ img: sp('cricket6'), q: 'Play hard. Play fair.' }],
  maryam_art: [{ img: sp('art7'), q: 'Colour is my daily bread.' }, { bg: '#8E4EC6', q: 'Create something today.' }],
  daniyal_t: [{ img: sp('food8'), q: 'Biryani is a love language.' }]
};
const myKey = 'myStories_' + ME.username;
const loadMine = () => { try { return JSON.parse(localStorage.getItem(myKey) || '[]'); } catch { return []; } };
function storyOrder() { return [...(loadMine().length ? [ME.username] : []), ...Object.keys(STORIES)]; }
function slidesOf(n) { return n === ME.username ? loadMine() : STORIES[n]; }
const NOTIFS = [
  { u: 'sara_m', t: 'liked your photo', ago: '2m', icon: 'heart', new: 1 },
  { u: 'bilal_dev', t: 'started following you', ago: '15m', icon: 'user-plus', new: 1 },
  { u: 'ayesha_k', t: 'commented: "Love this!"', ago: '1h', icon: 'message-circle', new: 1 },
  { u: 'omar_s', t: 'mentioned you in a comment', ago: '3h', icon: 'at', new: 1 },
  { u: 'zainab_a', t: 'liked your post', ago: '5h', icon: 'heart', new: 1 },
  { u: 'hamza_r', t: 'started following you', ago: '1d', icon: 'user-plus' },
  { u: 'maryam_art', t: 'liked your comment', ago: '2d', icon: 'heart' }
];
function renderNotifs() {
  $('#badge').textContent = NOTIFS.filter(n => n.new).length || '';
  $('#npanel').innerHTML = `<div class="nh"><b>Notifications</b><button data-a="readall">Mark all as read</button></div>` +
    NOTIFS.map(n => `<a class="ni ${n.new ? 'new' : ''}" href="#/u/${n.u}">${av(n.u, 38)}<p><b>${n.u}</b> ${esc(n.t)}<small>${n.ago} ago</small></p><i class="ti ti-${n.icon} t-${n.icon}"></i></a>`).join('');
}

/* ---------- sidebar ---------- */
async function loadSide() { try { MP = await api('/users/' + encodeURIComponent(ME.username)); } catch {} renderSide(); }
function renderSide() {
  const h = location.hash || '#/', p = MP || {};
  const nv = (href, i, t, on) => `<a class="nv ${on ? 'on' : ''}" href="${href}"><i class="ti ti-${i}"></i><span class="lbl">${t}</span></a>`;
  $('#side').innerHTML = `
    <div class="logo"><span><i class="ti ti-bolt"></i></span><b>Buzz</b></div>
    <div class="me"><a class="ring" href="#/u/${ME.username}"><span>${av(ME.username, 72)}</span></a><h3>${esc(ME.username)}</h3><small>@${esc(ME.username)}</small></div>
    <div class="stats3"><div><b>${p.postsCount ?? 0}</b><small>Posts</small></div><div><b>${p.followersCount ?? 0}</b><small>Followers</small></div><div><b>${p.followingCount ?? 0}</b><small>Following</small></div></div>
    <p class="mebio">${esc(p.bio || 'Add a bio on your profile')}</p>
    ${nv('#/', 'home', 'Feed', h === '#/' || h === '')}${nv('#/explore', 'compass', 'Explore', h === '#/explore')}${nv('#/u/' + ME.username, 'user', 'Profile', h === '#/u/' + ME.username)}
    <button class="nv" data-a="soon"><i class="ti ti-settings"></i><span class="lbl">Settings</span></button>
    <div class="bottom"><button class="nv" data-a="logout"><i class="ti ti-logout"></i><span class="lbl">Logout</span></button></div>`;
}

/* ---------- posts ---------- */
const likesText = (n, first, liked) => n ? `Liked by <b>${liked ? 'you' : esc(first || 'someone')}</b>${n > 1 ? ` and <b>${n - 1}</b> others` : ''}` : 'Be the first to like this';
const cmtHTML = c => `<div class="cm" data-cid="${c.id}">${av(c.author.username, 26)}<p><b>${esc(c.author.username)}</b> ${esc(c.text)}</p>${c.isMine ? '<button class="ic sm" data-a="delcm"><i class="ti ti-x"></i></button>' : ''}</div>`;
function card(p) {
  const n = p.author.username, sv_ = saved().includes(p.id);
  return `<article class="post" data-id="${p.id}" data-first="${esc(p.firstLiker || '')}">
    <header>${avl(n, 38)}<div class="who"><a href="#/u/${encodeURIComponent(n)}">${esc(n)}</a><small>${timeAgo(p.createdAt)}</small></div>${p.isMine ? '<button class="ic" data-a="delpost" title="Delete post"><i class="ti ti-trash"></i></button>' : ''}</header>
    ${p.image ? `<img class="pimg" src="${p.image}" loading="lazy" alt="" onerror="this.remove()">` : ''}
    <div class="acts"><button class="ic like ${p.liked ? 'on' : ''}" data-a="like"><i class="ti ti-heart${p.liked ? '-filled' : ''}"></i></button><button class="ic" data-a="cm"><i class="ti ti-message-circle"></i></button><button class="ic" data-a="share"><i class="ti ti-send"></i></button><button class="ic save ${sv_ ? 'on' : ''}" data-a="save"><i class="ti ti-bookmark${sv_ ? '-filled' : ''}"></i></button></div>
    <div class="likes">${likesText(p.likesCount, p.firstLiker, p.liked)}</div>
    ${p.content ? `<p class="cap"><b>${esc(n)}</b> ${esc(p.content)}</p>` : ''}
    <button class="vc" data-a="cm">View all <span class="cc">${p.commentsCount}</span> comments</button>
    <div class="cms hidden" data-loaded="0"></div></article>`;
}
async function loadPosts(reset) {
  const list = $('#posts');
  if (reset) { pg = 1; list.innerHTML = ''; }
  const ps = await api(`/posts?feed=${tab}&page=${pg}`);
  if (reset && !ps.length) list.innerHTML = `<div class="empty"><i class="ti ti-photo-heart"></i><p>${tab === 'following' ? 'Follow people to see their posts here.' : 'No posts yet. Be the first to share something.'}</p></div>`;
  else list.insertAdjacentHTML('beforeend', ps.map(card).join(''));
  $('#more').classList.toggle('hidden', ps.length < 10);
}

/* ---------- views ---------- */
const storiesHTML = () => {
  const mine = loadMine().length > 0;
  const own = `<button class="st me" data-a="${mine ? 'story' : 'addstory'}" data-u="${esc(ME.username)}"><span class="ring ${mine ? '' : 'none'}"><span>${av(ME.username, 60)}</span></span><em class="plus" data-a="addstory"><i class="ti ti-plus"></i></em><small>Your story</small></button>`;
  return own + Object.keys(STORIES).map(n => `<button class="st" data-a="story" data-u="${esc(n)}"><span class="ring"><span>${av(n, 60)}</span></span>${n === 'sara_m' ? '<b class="live">LIVE</b>' : ''}<small>${esc(n.split(/[_.]/)[0])}</small></button>`).join('');
};
const sugCard = u => `<div class="scard">${avl(u.username, 60)}<b>${esc(u.username)}</b><small>${esc(u.bio || '')}</small>${folBtn(u.id, u.isFollowing)}</div>`;

async function feedView() {
  view.dataset.uid = '';
  view.innerHTML = `
    <section class="sec"><h2>Stories</h2><div class="stories">${storiesHTML()}</div></section>
    <section class="sec"><h2>Who to follow</h2><div class="sug" id="sug"></div></section>
    <section class="sec"><div class="row"><h2>Feed</h2><div class="pills"><button class="pill ${tab === 'all' ? 'on' : ''}" data-a="tab" data-v="all">Everyone</button><button class="pill ${tab === 'following' ? 'on' : ''}" data-a="tab" data-v="following">Following</button></div></div>
    <div class="masonry" id="posts"></div><div class="center"><button class="btn ghost hidden" id="more" data-a="more">Load more</button></div></section>`;
  api('/users/suggestions?limit=6').then(us => $('#sug').innerHTML = us.length ? us.map(sugCard).join('') : '<p class="none">You follow everyone here. Nice!</p>').catch(() => {});
  loadPosts(true).catch(e => toast(e.message));
}
async function exploreView() {
  view.dataset.uid = '';
  view.innerHTML = '<section class="sec"><h2>Explore people</h2><div class="ugrid" id="ug"></div></section>';
  const us = await api('/users/all');
  $('#ug').innerHTML = us.map(u => `<div class="ucard"><div class="bn" style="${DEMO.includes(u.username) ? `background-image:url(https://picsum.photos/seed/cover-${encodeURIComponent(u.username)}/400/140)` : `background:${hue(u.username)}`}"></div>${avl(u.username, 64)}<b>${esc(u.username)}</b><small>${esc(u.bio || '')}</small>${folBtn(u.id, u.isFollowing)}</div>`).join('');
}
async function profileView(name) {
  const p = await api('/users/' + encodeURIComponent(name));
  view.dataset.uid = p.id;
  view.innerHTML = `
    <div class="cover" style="${DEMO.includes(p.username) ? `background-image:url(https://picsum.photos/seed/cover-${encodeURIComponent(p.username)}/1200/320)` : `background:${hue(p.username)}`}"></div>
    <div class="pinfo"><div class="pav">${av(p.username, 112)}</div>
      <div class="pmeta"><h1>${esc(p.username)}</h1><span>@${esc(p.username)}</span><p>${esc(p.bio || 'No bio yet')}</p>
        <div class="pstats"><span><b>${p.postsCount}</b> posts</span><span><b id="fc">${p.followersCount}</b> followers</span><span><b>${p.followingCount}</b> following</span></div></div>
      <div class="pact">${p.isMe ? '<button class="btn ghost" data-a="edit"><i class="ti ti-pencil"></i> Edit profile</button>' : folBtn(p.id, p.isFollowing)}</div></div>
    <div class="masonry" id="posts"></div>`;
  const ps = await api('/posts/user/' + encodeURIComponent(name));
  $('#posts').innerHTML = ps.length ? ps.map(card).join('') : '<div class="empty"><i class="ti ti-camera"></i><p>No posts yet.</p></div>';
}
function route() {
  const h = location.hash || '#/';
  $('#main').scrollTop = 0; renderSide();
  const run = h.startsWith('#/u/') ? profileView(decodeURIComponent(h.slice(4))) : h === '#/explore' ? exploreView() : feedView();
  Promise.resolve(run).catch(e => { view.innerHTML = `<div class="empty"><i class="ti ti-mood-sad"></i><p>${esc(e.message)}</p></div>`; });
}

/* ---------- modal ---------- */
const openModal = html => { $('#modal').innerHTML = `<div class="modal" data-a="bd"><div class="mbox">${html}</div></div>`; };
const closeModal = () => { $('#modal').innerHTML = ''; pendingImg = null; pendingAv = null; };
function openCompose() {
  pendingImg = null;
  openModal(`<div class="mh"><h3>Create post</h3><button class="ic" data-a="close"><i class="ti ti-x"></i></button></div>
    <div class="mb"><div class="who2">${av(ME.username, 40)}${esc(ME.username)}</div>
    <textarea id="pt" maxlength="500" placeholder="What's on your mind?"></textarea>
    <div id="prev" class="prev hidden"><img id="pimg" alt=""><button class="ic rm" data-a="rmimg"><i class="ti ti-x"></i></button></div>
    <label class="addimg"><i class="ti ti-photo"></i> Add photo<input type="file" id="pf" accept="image/*" hidden></label></div>
    <div class="mf"><span id="cnt">500</span><button class="btn" data-a="submit">Post</button></div>`);
  $('#pt').focus();
}
function fileToDataUrl(file, max = 1200) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const im = new Image();
      im.onload = () => {
        const k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas');
        c.width = im.width * k; c.height = im.height * k;
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', .85));
      };
      im.onerror = rej; im.src = r.result;
    };
    r.onerror = rej; r.readAsDataURL(file);
  });
}

/* ---------- add a story ---------- */
const SWATCH = ['#F5516C', '#5B5BD6', '#12A594', '#E08A00', '#D6409F', '#2F80ED', '#8E4EC6'];
function openAddStory() {
  storyDraft = { img: null, bg: SWATCH[0] };
  openModal(`<div class="mh"><h3>Add to your story</h3><button class="ic" data-a="close"><i class="ti ti-x"></i></button></div>
    <div class="mb"><div class="sprev" id="sprevbox" style="background:${SWATCH[0]}"><p id="sprevq">Your words here</p></div>
    <input id="sqin" class="qin" maxlength="80" placeholder="Write a quote or caption">
    <div class="sw">${SWATCH.map((c, i) => `<button class="swb ${i ? '' : 'on'}" data-a="swatch" data-c="${c}" style="background:${c}" aria-label="Colour ${i + 1}"></button>`).join('')}</div>
    <label class="addimg"><i class="ti ti-photo"></i> Add photo<input type="file" id="sf" accept="image/*" hidden></label></div>
    <div class="mf"><button class="btn" data-a="sharestory">Share to story</button></div>`);
}

/* ---------- story viewer ---------- */
function openStory(n) { const order = storyOrder(); sv = { order, ui: order.indexOf(n), si: 0 }; showSlide(); }
function closeStory() { if (sv) clearTimeout(sv.t); sv = null; $('#story').innerHTML = ''; }
function showSlide() {
  clearTimeout(sv.t);
  const n = sv.order[sv.ui], sl = slidesOf(n), s = sl[sv.si];
  $('#story').innerHTML = `<div class="modal story" data-a="sbd"><div class="sbox" style="${s.bg ? 'background:' + s.bg : ''}">${s.img ? `<img class="sbg" src="${s.img}" alt="">` : ''}<div class="sov"></div>
    <div class="bars">${sl.map((_, i) => `<span class="bar ${i < sv.si ? 'done' : i === sv.si ? 'cur' : ''}"><i></i></span>`).join('')}</div>
    <div class="sh">${av(n, 36)}<b>${n === ME.username ? 'Your story' : esc(n)}</b><small>${n === ME.username ? 'now' : (2 + sv.si) + 'h'}</small></div>
    ${s.q ? `<p class="sq">${esc(s.q)}</p>` : ''}
    <button class="zl" data-a="sprev" aria-label="Previous"></button><button class="zr" data-a="snext" aria-label="Next"></button></div>
    <button class="ic sclose" data-a="sclose" aria-label="Close"><i class="ti ti-x"></i></button></div>`;
  requestAnimationFrame(() => requestAnimationFrame(() => { const i = $('#story .bar.cur i'); if (i) i.classList.add('run'); }));
  sv.t = setTimeout(snext, 5000);
}
function snext() {
  if (!sv) return;
  if (sv.si < slidesOf(sv.order[sv.ui]).length - 1) sv.si++;
  else if (sv.ui < sv.order.length - 1) { sv.ui++; sv.si = 0; }
  else return closeStory();
  showSlide();
}
function sprev() {
  if (sv.si > 0) sv.si--; else if (sv.ui > 0) { sv.ui--; sv.si = 0; }
  showSlide();
}

/* ---------- events ---------- */
document.addEventListener('click', async e => {
  if (!e.target.closest('.search')) $('#sres').classList.add('hidden');
  if (!e.target.closest('.bellwrap')) $('#npanel').classList.add('hidden');
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const a = el.dataset.a, post = el.closest('.post'), id = post && post.dataset.id;
  if ((a === 'bd' || a === 'sbd') && e.target !== el) return;
  try {
    if (a === 'logout') logout();
    if (a === 'soon') toast('Settings are coming soon');
    if (a === 'bell') { $('#npanel').classList.toggle('hidden'); $('#badge').textContent = ''; }
    if (a === 'readall') { NOTIFS.forEach(n => n.new = 0); renderNotifs(); }
    if (a === 'compose') openCompose();
    if (a === 'close' || a === 'bd') closeModal();
    if (a === 'story') openStory(el.dataset.u);
    if (a === 'snext') snext();
    if (a === 'sprev') sprev();
    if (a === 'sclose' || a === 'sbd') closeStory();
    if (a === 'tab') { tab = el.dataset.v; $$('.pill').forEach(b => b.classList.toggle('on', b.dataset.v === tab)); await loadPosts(true); }
    if (a === 'more') { pg++; await loadPosts(false); }
    if (a === 'rmimg') { pendingImg = null; $('#prev').classList.add('hidden'); $('#pf').value = ''; }

    if (a === 'fol') {
      const fid = el.dataset.id, r = await api(`/users/${fid}/follow`, 'POST');
      $$(`.fol[data-id="${fid}"]`).forEach(b => setFol(b, r.following));
      if ($('#fc') && view.dataset.uid === fid) $('#fc').textContent = r.followersCount;
      toast(r.following ? 'You are now following' : 'Unfollowed'); loadSide();
    }
    if (a === 'like') {
      const r = await api(`/posts/${id}/like`, 'POST');
      el.classList.toggle('on', r.liked); el.classList.add('pop');
      el.innerHTML = `<i class="ti ti-heart${r.liked ? '-filled' : ''}"></i>`;
      post.querySelector('.likes').innerHTML = likesText(r.likesCount, post.dataset.first, r.liked);
    }
    if (a === 'cm') {
      const box = post.querySelector('.cms'); box.classList.toggle('hidden');
      if (box.dataset.loaded === '0') {
        const cs = await api(`/posts/${id}/comments`);
        box.innerHTML = cs.map(cmtHTML).join('') + '<div class="cform"><input placeholder="Add a comment..." maxlength="300"><button class="btn sm" data-a="send">Post</button></div>';
        box.dataset.loaded = '1';
      }
    }
    if (a === 'send') {
      const input = post.querySelector('.cform input'), text = input.value.trim();
      if (!text) return;
      const c = await api(`/posts/${id}/comments`, 'POST', { text });
      post.querySelector('.cform').insertAdjacentHTML('beforebegin', cmtHTML(c));
      input.value = ''; const cc = post.querySelector('.cc'); cc.textContent = +cc.textContent + 1;
    }
    if (a === 'delcm') {
      const row = el.closest('.cm'); await api(`/posts/${id}/comments/${row.dataset.cid}`, 'DELETE');
      row.remove(); const cc = post.querySelector('.cc'); cc.textContent = Math.max(0, +cc.textContent - 1);
    }
    if (a === 'delpost') {
      if (!confirm('Delete this post?')) return;
      await api(`/posts/${id}`, 'DELETE'); post.remove(); toast('Post deleted'); loadSide();
    }
    if (a === 'share') {
      const n = post.querySelector('.who a').textContent;
      navigator.clipboard && navigator.clipboard.writeText(`${location.origin}/#/u/${n}`); toast('Link copied');
    }
    if (a === 'save') {
      let s = saved(); const on = !s.includes(id); s = on ? [...s, id] : s.filter(x => x !== id);
      localStorage.setItem('saved', JSON.stringify(s));
      el.classList.toggle('on', on); el.innerHTML = `<i class="ti ti-bookmark${on ? '-filled' : ''}"></i>`; toast(on ? 'Saved' : 'Removed from saved');
    }
    if (a === 'clearq') { $('#q').value = ''; $('#sres').classList.add('hidden'); }
    if (a === 'edit') {
      pendingAv = null;
      openModal(`<div class="mh"><h3>Edit profile</h3><button class="ic" data-a="close"><i class="ti ti-x"></i></button></div>
        <div class="mb"><div class="avedit"><span id="avprev">${av(ME.username, 84)}</span><label class="addimg"><i class="ti ti-camera"></i> Change photo<input type="file" id="af" accept="image/*" hidden></label></div>
        <textarea id="bio" maxlength="160" placeholder="Tell people about yourself">${esc((MP && MP.bio) || '')}</textarea></div>
        <div class="mf"><button class="btn" data-a="savebio">Save</button></div>`);
    }
    if (a === 'savebio') {
      const body = { bio: $('#bio').value }; if (pendingAv) body.avatar = pendingAv;
      await api('/users/me', 'PUT', body); closeModal(); toast('Profile updated'); await loadSide(); route();
    }
    if (a === 'addstory') openAddStory();
    if (a === 'swatch') {
      storyDraft.bg = el.dataset.c; storyDraft.img = null;
      $$('.swb').forEach(b => b.classList.toggle('on', b === el));
      $('#sprevbox').style.background = el.dataset.c;
    }
    if (a === 'sharestory') {
      const q = $('#sqin').value.trim();
      if (!q && !storyDraft.img) return toast('Add a photo or write something');
      const m = loadMine(); m.push({ q, ...(storyDraft.img ? { img: storyDraft.img } : { bg: storyDraft.bg }) });
      try { localStorage.setItem(myKey, JSON.stringify(m)); } catch { return toast('Not enough space for that photo'); }
      closeModal(); toast('Added to your story');
      const row = $('.stories'); if (row) row.innerHTML = storiesHTML();
    }
    if (a === 'submit') {
      const content = $('#pt').value.trim();
      if (!content && !pendingImg) return toast('Write something or add a photo');
      el.disabled = true;
      try {
        const p = await api('/posts', 'POST', { content, image: pendingImg || undefined });
        closeModal(); toast('Posted!'); loadSide();
        const h = location.hash;
        if (h === '#/u/' + ME.username) route();
        else if ((h === '' || h === '#/') && tab === 'all' && $('#posts')) { const l = $('#posts'); const em = l.querySelector('.empty'); if (em) em.remove(); l.insertAdjacentHTML('afterbegin', card(p)); }
        else location.hash = '#/';
      } finally { el.disabled = false; }
    }
  } catch (err) { toast(err.message); }
});

document.addEventListener('input', e => {
  if (e.target.id === 'pt') $('#cnt').textContent = 500 - e.target.value.length;
  if (e.target.id === 'sqin') $('#sprevq').textContent = e.target.value || 'Your words here';
});
document.addEventListener('change', async e => {
  const f = e.target.files && e.target.files[0], id = e.target.id;
  if (!f || !['pf', 'sf', 'af'].includes(id)) return;
  try {
    if (id === 'pf') { pendingImg = await fileToDataUrl(f); $('#pimg').src = pendingImg; $('#prev').classList.remove('hidden'); }
    if (id === 'sf') { storyDraft.img = await fileToDataUrl(f, 700); $('#sprevbox').style.background = `center/cover url("${storyDraft.img}")`; }
    if (id === 'af') { pendingAv = await fileToDataUrl(f, 400); $('#avprev').innerHTML = `<img class="av" style="width:84px;height:84px" src="${pendingAv}" alt="">`; }
  } catch { toast('Could not read that image'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') { closeModal(); closeStory(); }
  if (sv && e.key === 'ArrowRight') snext();
  if (sv && e.key === 'ArrowLeft') sprev();
  if (e.key === 'Enter' && e.target.matches('.cform input')) e.target.closest('.cform').querySelector('[data-a="send"]').click();
});

let st;
$('#q').addEventListener('input', e => {
  clearTimeout(st);
  const v = e.target.value.trim(), box = $('#sres');
  if (!v) return box.classList.add('hidden');
  st = setTimeout(async () => {
    try {
      const us = await api('/users/search?q=' + encodeURIComponent(v));
      box.innerHTML = us.length ? us.map(u => `<a href="#/u/${encodeURIComponent(u.username)}" data-a="clearq">${av(u.username, 36)}<span><b>${esc(u.username)}</b><small>${esc(u.bio || '')}</small></span></a>`).join('') : '<p class="none">No people found</p>';
      box.classList.remove('hidden');
    } catch {}
  }, 250);
});

window.addEventListener('hashchange', route);
renderNotifs(); loadSide(); route();
