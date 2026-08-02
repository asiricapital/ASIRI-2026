(() => {
  const STORAGE_KEY = 'asiri-intelligence-core.v01';
  const cloud = window.AsiriCloud;
  const $ = selector => document.querySelector(selector);
  let lastSnapshot = localStorage.getItem(STORAGE_KEY) || '';
  let pushTimer = null;
  let applyingRemote = false;

  function setStatus(mode, text, user = '') {
    const box = $('#cloudStatus');
    const label = $('#cloudStatusText');
    const userLabel = $('#cloudUser');
    if (!box || !label) return;
    box.classList.toggle('online', mode === 'online');
    box.classList.toggle('syncing', mode === 'syncing');
    label.textContent = text;
    if (userLabel) userLabel.textContent = user;
  }

  function message(text, error = false) {
    const el = $('#authMessage');
    if (!el) return;
    el.textContent = text;
    el.style.color = error ? '#fca5a5' : '';
  }

  function currentPayload() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch { return null; }
  }

  async function pullAndApply() {
    const remote = await cloud.pullWorkspace();
    if (!remote) return false;
    applyingRemote = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
    lastSnapshot = localStorage.getItem(STORAGE_KEY) || '';
    applyingRemote = false;
    sessionStorage.setItem('asiri-cloud-pulled', '1');
    location.reload();
    return true;
  }

  async function pushNow() {
    if (!cloud.isConfigured() || !cloud.getSession() || applyingRemote) return;
    const payload = currentPayload();
    if (!payload) return;
    try {
      setStatus('syncing', 'جارٍ المزامنة…', cloud.getSession().user.email || '');
      await cloud.pushWorkspace(payload);
      setStatus('online', 'متزامن مع السحابة', cloud.getSession().user.email || '');
    } catch (error) {
      console.error('[Asiri Cloud push]', error);
      setStatus('offline', 'تعذر المزامنة — محفوظ محليًا', cloud.getSession()?.user?.email || '');
    }
  }

  function schedulePush() {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushNow, 700);
  }

  function watchLocalChanges() {
    setInterval(() => {
      const next = localStorage.getItem(STORAGE_KEY) || '';
      if (next !== lastSnapshot) {
        lastSnapshot = next;
        schedulePush();
      }
    }, 650);
  }

  async function handleSignedIn() {
    const session = cloud.getSession();
    const email = session?.user?.email || '';
    $('#cloudAuthButton').textContent = 'تسجيل الخروج';
    $('#sidebarUser').textContent = email || 'Ahmed Asiri';
    $('#sidebarRole').textContent = 'Cloud Workspace';
    setStatus('syncing', 'جارٍ جلب السحابة…', email);
    const alreadyPulled = sessionStorage.getItem('asiri-cloud-pulled') === '1';
    if (!alreadyPulled) {
      try {
        const applied = await pullAndApply();
        if (applied) return;
      } catch (error) {
        console.error('[Asiri Cloud pull]', error);
      }
    }
    await pushNow();
  }

  async function handleSignedOut() {
    sessionStorage.removeItem('asiri-cloud-pulled');
    $('#cloudAuthButton').textContent = cloud.isConfigured() ? 'تسجيل الدخول' : 'إعداد السحابة';
    $('#cloudUser').textContent = '';
    $('#sidebarUser').textContent = 'Ahmed Asiri';
    $('#sidebarRole').textContent = 'Local Workspace';
    setStatus('offline', cloud.isConfigured() ? 'السحابة جاهزة — غير مسجل' : 'وضع محلي آمن');
  }

  async function submitAuth(event) {
    event.preventDefault();
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    message('جارٍ تسجيل الدخول…');
    try {
      await cloud.signIn(email, password);
      $('#authModal').close();
      await handleSignedIn();
    } catch (error) {
      message(error.message || 'تعذر تسجيل الدخول.', true);
    }
  }

  async function signUp() {
    const email = $('#authEmail').value.trim();
    const password = $('#authPassword').value;
    if (!email || password.length < 6) {
      message('أدخل بريدًا صحيحًا وكلمة مرور من 6 أحرف على الأقل.', true);
      return;
    }
    message('جارٍ إنشاء الحساب…');
    try {
      const result = await cloud.signUp(email, password);
      if (result.session) {
        $('#authModal').close();
        await handleSignedIn();
      } else {
        message('تم إنشاء الحساب. تحقق من البريد لتأكيد التسجيل ثم سجّل الدخول.');
      }
    } catch (error) {
      message(error.message || 'تعذر إنشاء الحساب.', true);
    }
  }

  async function authButtonClick() {
    if (!cloud.isConfigured()) {
      alert('أضف Supabase URL وAnon Key في ملف config.js، ثم نفّذ Migration 0002_workspace_snapshots.sql.');
      return;
    }
    if (cloud.getSession()) {
      await cloud.signOut();
      await handleSignedOut();
      return;
    }
    message('أدخل بيانات حسابك في Asiri Cloud.');
    $('#authModal').showModal();
  }

  async function init() {
    $('#cloudAuthButton')?.addEventListener('click', authButtonClick);
    $('#authForm')?.addEventListener('submit', submitAuth);
    $('#signUpButton')?.addEventListener('click', signUp);
    $('#closeAuth')?.addEventListener('click', () => $('#authModal').close());
    cloud.subscribe(state => {
      if (state.type === 'sync-start') setStatus('syncing', 'جارٍ المزامنة…', state.session?.user?.email || '');
      if (state.type === 'sync-complete') setStatus('online', 'متزامن مع السحابة', state.session?.user?.email || '');
      if (state.type === 'signed-out') handleSignedOut();
    });
    try {
      const state = await cloud.init();
      if (!state.configured) await handleSignedOut();
      else if (state.session) await handleSignedIn();
      else await handleSignedOut();
    } catch (error) {
      console.error('[Asiri Cloud init]', error);
      setStatus('offline', 'تعذر الاتصال — محفوظ محليًا');
    }
    watchLocalChanges();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
