const $ = selector => document.querySelector(selector);
const results = $('#results');
const resultCount = $('#resultCount');
const searchInput = $('#searchInput');
const loadMoreButton = $('#loadMoreButton');
const searchLimitNote = $('#searchLimitNote');
const trackTemplate = $('#trackTemplate');

const PAGE_SIZE = 10;
const MAX_RESULTS = 50;
let activeQuery = '';
let loading = false;
let hasMore = false;

async function refreshToken() {
  const refreshToken = localStorage.getItem('spotify_refresh_token');
  if (!refreshToken) return null;
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({
      client_id: '3ac122f971744e508bfd33ad0637d421',
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    })
  });
  if (!response.ok) return null;
  const payload = await response.json();
  localStorage.setItem('spotify_access_token', payload.access_token);
  localStorage.setItem('spotify_expires_at', String(Date.now() + payload.expires_in * 1000 - 60000));
  if (payload.refresh_token) localStorage.setItem('spotify_refresh_token', payload.refresh_token);
  return payload.access_token;
}

async function token() {
  const accessToken = localStorage.getItem('spotify_access_token');
  const expiresAt = Number(localStorage.getItem('spotify_expires_at') || 0);
  if (accessToken && Date.now() < expiresAt) return accessToken;
  return refreshToken();
}

async function api(path, options = {}) {
  const accessToken = await token();
  if (!accessToken) throw new Error('AUTH_REQUIRED');
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) throw new Error(`SPOTIFY_${response.status}`);
  return response.status === 204 ? null : response.json();
}

function favorites() {
  return JSON.parse(localStorage.getItem('asiri_favorites') || '[]');
}

function updateFavoriteStats(items) {
  const favoriteStat = $('#favoriteStat');
  const favoriteCount = $('#favoriteCount');
  if (favoriteStat) favoriteStat.textContent = items.length;
  if (favoriteCount) favoriteCount.textContent = items.length ? `${items.length} أغنية` : '';
}

function toggleFavorite(track, button) {
  const items = favorites();
  const index = items.findIndex(item => item.id === track.id);
  if (index >= 0) items.splice(index, 1);
  else items.unshift({id: track.id, name: track.name, uri: track.uri, artists: track.artists, album: track.album, external_urls: track.external_urls});
  localStorage.setItem('asiri_favorites', JSON.stringify(items));
  const active = items.some(item => item.id === track.id);
  button.classList.toggle('active', active);
  button.textContent = active ? '♥ ضمن مفضلتي' : '♡ مفضلة Asiri';
  updateFavoriteStats(items);
}

async function playTrack(track, button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'جارٍ التشغيل...';
  try {
    const devices = await api('/me/player/devices');
    const device = devices.devices?.find(item => item.name === 'Asiri Music Player') || devices.devices?.find(item => item.is_active);
    if (!device) throw new Error('NO_DEVICE');
    await api(`/me/player/play?device_id=${encodeURIComponent(device.id)}`, {
      method: 'PUT',
      body: JSON.stringify({uris: [track.uri || `spotify:track:${track.id}`]})
    });
    button.textContent = 'يعمل الآن ✓';
  } catch {
    button.textContent = 'تعذر التشغيل';
  } finally {
    setTimeout(() => {
      button.disabled = false;
      button.textContent = original;
    }, 1600);
  }
}

function createCard(track) {
  const node = trackTemplate.content.cloneNode(true);
  const favoriteButton = node.querySelector('.favorite-track');
  const savedFavorites = favorites();
  const active = savedFavorites.some(item => item.id === track.id);
  node.querySelector('.track-cover').src = track.album?.images?.[0]?.url || '';
  node.querySelector('.track-name').textContent = track.name || 'بدون اسم';
  node.querySelector('.track-artist').textContent = track.artists?.map(item => item.name).join('، ') || '';
  node.querySelector('.track-album').textContent = track.album?.name || '';
  node.querySelector('.open-spotify').href = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
  node.querySelector('.play-track').onclick = event => playTrack(track, event.currentTarget);
  favoriteButton.classList.toggle('active', active);
  favoriteButton.textContent = active ? '♥ ضمن مفضلتي' : '♡ مفضلة Asiri';
  favoriteButton.onclick = () => toggleFavorite(track, favoriteButton);
  node.querySelector('.save-track').onclick = async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api('/me/library', {method: 'PUT', body: JSON.stringify({uris: [track.uri || `spotify:track:${track.id}`]})});
      button.textContent = 'تم الحفظ ✓';
    } catch {
      button.textContent = 'تعذر الحفظ';
    } finally {
      button.disabled = false;
    }
  };
  return node;
}

function syncControls() {
  const count = results?.children.length || 0;
  resultCount.textContent = count ? `${count} نتيجة` : '';
  const reachedLimit = count >= MAX_RESULTS;
  loadMoreButton.classList.toggle('hidden', !activeQuery || !hasMore || reachedLimit);
  searchLimitNote.classList.toggle('hidden', !reachedLimit);
  searchLimitNote.textContent = reachedLimit ? 'تم عرض أول 50 نتيجة.' : '';
}

async function loadMore() {
  if (loading || !activeQuery) return;
  loading = true;
  loadMoreButton.disabled = true;
  loadMoreButton.textContent = 'جارٍ تحميل نتائج إضافية...';
  try {
    const offset = results.children.length;
    const params = new URLSearchParams({q: activeQuery, type: 'track', limit: String(PAGE_SIZE), offset: String(offset)});
    const data = await api(`/search?${params}`);
    const items = data.tracks?.items || [];
    const existing = new Set([...results.querySelectorAll('.open-spotify')].map(link => link.href));
    items.forEach(track => {
      const url = track.external_urls?.spotify || `https://open.spotify.com/track/${track.id}`;
      if (!existing.has(url)) results.appendChild(createCard(track));
    });
    hasMore = Boolean(data.tracks?.next) && items.length > 0;
  } catch {
    searchLimitNote.classList.remove('hidden');
    searchLimitNote.textContent = 'تعذر تحميل المزيد الآن. حاول مرة أخرى.';
  } finally {
    loading = false;
    loadMoreButton.disabled = false;
    loadMoreButton.textContent = 'عرض 10 نتائج إضافية';
    syncControls();
  }
}

loadMoreButton?.addEventListener('click', loadMore);

const observer = new MutationObserver(() => {
  const query = searchInput?.value.trim() || '';
  if (results.children.length > 0 && query) {
    if (query !== activeQuery) {
      activeQuery = query;
      hasMore = results.children.length >= PAGE_SIZE;
    }
    syncControls();
  } else {
    activeQuery = query;
    hasMore = false;
    syncControls();
  }
});

if (results) observer.observe(results, {childList: true});
searchInput?.addEventListener('input', () => {
  if (searchInput.value.trim() !== activeQuery) {
    loadMoreButton.classList.add('hidden');
    searchLimitNote.classList.add('hidden');
  }
});
