const form = $('#authForm');
const isRegister = form.dataset.mode === 'register';
if (token()) location.href = 'index.html';

form.addEventListener('submit', async e => {
  e.preventDefault();
  $('#error').textContent = '';
  const btn = form.querySelector('button');
  btn.disabled = true;
  try {
    const data = Object.fromEntries(new FormData(form));
    const r = await api(isRegister ? '/auth/register' : '/auth/login', 'POST', data);
    localStorage.setItem('token', r.token);
    localStorage.setItem('user', JSON.stringify(r.user));
    location.href = 'index.html';
  } catch (err) {
    $('#error').textContent = err.message;
    btn.disabled = false;
  }
});
