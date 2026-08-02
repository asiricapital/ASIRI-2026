(() => {
  const cfg = window.ASIRI_SUPABASE_CONFIG || {};
  const configured = Boolean(cfg.url && cfg.anonKey && window.supabase?.createClient);
  const client = configured ? window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  }) : null;

  const listeners = new Set();
  let session = null;
  let syncing = false;

  function emit(type, detail = {}) {
    const payload = { type, configured, session, syncing, ...detail };
    listeners.forEach(fn => { try { fn(payload); } catch (error) { console.error(error); } });
    window.dispatchEvent(new CustomEvent('asiri:cloud-state', { detail: payload }));
  }

  async function init() {
    if (!configured) {
      emit('unconfigured');
      return { configured: false, session: null };
    }
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    session = data.session;
    client.auth.onAuthStateChange((_event, nextSession) => {
      session = nextSession;
      emit('auth-changed');
    });
    emit('ready');
    return { configured: true, session };
  }

  async function signIn(email, password) {
    if (!configured) throw new Error('لم تتم إضافة إعدادات Supabase بعد.');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    session = data.session;
    emit('signed-in');
    return data;
  }

  async function signUp(email, password) {
    if (!configured) throw new Error('لم تتم إضافة إعدادات Supabase بعد.');
    const { data, error } = await client.auth.signUp({ email, password });
    if (error) throw error;
    session = data.session;
    emit('signed-up');
    return data;
  }

  async function signOut() {
    if (!configured) return;
    const { error } = await client.auth.signOut();
    if (error) throw error;
    session = null;
    emit('signed-out');
  }

  async function pullWorkspace() {
    if (!configured || !session?.user) return null;
    syncing = true;
    emit('sync-start');
    try {
      const { data, error } = await client
        .from('workspace_snapshots')
        .select('payload,updated_at,version')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (error) throw error;
      emit('sync-complete', { direction: 'pull', updatedAt: data?.updated_at || null });
      return data?.payload || null;
    } finally {
      syncing = false;
      emit('sync-idle');
    }
  }

  async function pushWorkspace(payload) {
    if (!configured || !session?.user) return false;
    syncing = true;
    emit('sync-start');
    try {
      const row = {
        user_id: session.user.id,
        payload,
        version: 1,
        updated_at: new Date().toISOString()
      };
      const { error } = await client.from('workspace_snapshots').upsert(row, { onConflict: 'user_id' });
      if (error) throw error;
      emit('sync-complete', { direction: 'push', updatedAt: row.updated_at });
      return true;
    } finally {
      syncing = false;
      emit('sync-idle');
    }
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  window.AsiriCloud = {
    init,
    signIn,
    signUp,
    signOut,
    pullWorkspace,
    pushWorkspace,
    subscribe,
    isConfigured: () => configured,
    getSession: () => session,
    getClient: () => client
  };
})();
