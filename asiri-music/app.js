const CLIENT_ID = '3163isshqg6ym3o7xracjn4js7ce';
const SCOPES = [
  'user-read-private',
  'user-read-email',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-modify-private',
  'playlist-modify-public'
];

const redirectUri = new URL('callback.html', window.location.href).href;
const authButton = document.querySelector('#authButton');
const logoutButton = document.querySelector('#logoutButton');
const profileCard = document.querySelector('#profileCard');
const profileImage = document.querySelector('#profileImage');
const profileName = document.querySelector('#profileName');
const profilePlan = document.querySelector('#profilePlan');
const searchForm = document.querySelector('#searchForm');
const searchInput = document.querySelector('#searchInput');
const results = document.querySelector('#results');
const playlists = document.querySelector('#playlists');
const resultCount = document.querySelector('#resultCount');
const statusText = document.querySelector('#statusText');
const refreshPlaylists = document.querySelector('#refreshPlaylists');
const trackTemplate = document.querySelector('#trackTemplate');

function base64url(input) {
  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

async function sha256(text) {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
}

function randomString(length = 64) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, value => chars[value % chars.length]).join('');
}

function storeTokens(payload) {
  const expiresAt = Date.now() + payload.expires_in * 1000 - 60000;
  localStorage.setItem('spotify_access_token', payload.access_token);
  localStorage.setItem('spotify_expires_at', String(expiresAt));
  if (payload.refresh_token) localStorage.setItem('spotify_refresh_token', payload.refresh_token);
}

function clearTokens() {
  ['spotify_access_token', 'spotify_expires_at', 'spotify_refresh_token', 'spotify_code_verifier']
    .forEach(key => localStorage.removeItem(key));
}

async function login() {
  const verifier = randomString();
  const challenge = base64url(await sha256(verifier));
  localStorage.setItem('spotify_code_verifier', verifier);
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES.join(' '),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    show_dialog: 'true'
  });
  window.location.href = `https://accounts.spotify.com/authorize?${params}`;
}

async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) return null;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  storeTokens(payload);
  return payload.access_token;
}

async function getAccessToken() {
  const token = localStorage.getItem('spotify_access_token');
  const expiresAt = Number(localStorage.getItem('spotify_expires_at') || 0);
  if (token && Date.now() < expiresAt) return token;
  return refreshAccessToken();
}

async function spotify(path, options = {}) {
  const token = await getAccessToken();
  if (!token) throw new Error('AUTH_REQUIRED');
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (response.status === 401) {
    clearTokens();
    throw new Error('AUTH_REQUIRED');
  }
  if (!response.ok) throw new Error(`SPOTIFY_${response.status}`);
  return response.status === 204 ? null : response.json();
}

async function loadProfile() {
  try {
    const me = await spotify('/me');
    profileName.textContent = me.display_name || me.id;
    profilePlan.textContent = me.product === 'premium' ? 'Spotify Premium' : `الخطة: ${me.product || 'غير معروفة'}`;
    profileImage.src = me.images?.[0]?.url || '';
    profileCard.classList.remove('hidden');
    authButton.classList.add('hidden');
    statusText.textContent = 'تم الربط بنجاح. ابحث الآن عن أي أغنية أو فنان.';
    await loadPlaylists();
  } catch {
    profileCard.classList.add('hidden');
    authButton.classList.remove('hidden');
  }
}

function renderTracks(items = []) {
  results.innerHTML = '';
  resultCount.textContent = items.length ? `${items.length} نتيجة` : '';
  for (const track of items) {
    const node = trackTemplate.content.cloneNode(true);
    node.querySelector('.track-cover').src = track.album?.images?.[0]?.url || '';
    node.querySelector('.track-name').textContent = track.name;
    node.querySelector('.track-artist').textContent = track.artists?.map(a => a.name).join('، ');
    node.querySelector('.track-album').textContent = track.album?.name || '';
    node.querySelector('.open-spotify').href = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
    node.querySelector('.save-track').addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        await spotify(`/me/tracks?ids=${encodeURIComponent(track.id)}`, { method: 'PUT' });
        button.textContent = 'تم الحفظ ✓';
      } catch {
        button.textContent = 'تعذر الحفظ';
      } finally {
        button.disabled = false;
      }
    });
    results.appendChild(node);
  }
}

async function searchTracks(query) {
  statusText.textContent = 'جارٍ البحث...';
  try {
    const data = await spotify(`/search?type=track&limit=20&q=${encodeURIComponent(query)}`);
    renderTracks(data.tracks?.items || []);
    statusText.textContent = data.tracks?.items?.length ? 'اضغط فتح في Spotify للتشغيل، أو حفظ لإضافتها إلى أغانيك.' : 'لم يتم العثور على نتائج.';
  } catch (error) {
    statusText.textContent = error.message === 'AUTH_REQUIRED' ? 'سجّل الدخول أولًا.' : 'تعذر إكمال البحث الآن.';
  }
}

async function loadPlaylists() {
  playlists.innerHTML = '';
  try {
    const data = await spotify('/me/playlists?limit=20');
    for (const item of data.items || []) {
      const link = document.createElement('a');
      link.className = 'playlist-card';
      link.href = item.external_urls?.spotify || `https://open.spotify.com/playlist/${item.id}`;
      link.target = '_blank';
      link.rel = 'noopener';
      const image = item.images?.[0]?.url || '';
      link.innerHTML = `<img src="${image}" alt=""><div><strong></strong><span></span></div>`;
      link.querySelector('strong').textContent = item.name;
      link.querySelector('span').textContent = `${item.tracks?.total || 0} أغنية`;
      playlists.appendChild(link);
    }
  } catch {
    playlists.innerHTML = '<p class="status-text">سجّل الدخول لعرض قوائمك.</p>';
  }
}

authButton.addEventListener('click', login);
logoutButton.addEventListener('click', () => {
  clearTokens();
  location.reload();
});
searchForm.addEventListener('submit', event => {
  event.preventDefault();
  const query = searchInput.value.trim();
  if (query) searchTracks(query);
});
refreshPlaylists.addEventListener('click', loadPlaylists);

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
loadProfile();
