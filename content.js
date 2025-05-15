const host = document.createElement('div');
host.id = 'spotify-mini-player-host';
const shadow = host.attachShadow({ mode: 'open' });
document.body.appendChild(host);

const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = chrome.runtime.getURL('styles.css');
shadow.appendChild(link);

const container = document.createElement('div');
container.id = 'spotify-mini-player';
container.innerHTML = `
  <div class="player-body">
    <div id="loading">Loading…</div>
    <img id="album-art" src="" alt="Album Art" />
    <div id="track-info">Not playing</div>
    <div id="track-artists"></div>
    <div class="controls">
      <button id="prev">⏮️</button>
      <button id="play-pause">▶️</button>
      <button id="next">⏭️</button>
    </div>
  </div>
  <button id="toggle-button" title="Hide player">🔽</button>`;
shadow.appendChild(container);

let alreadyPlaying = false;
const $ = selector => shadow.querySelector(selector);

function showLoading() {
  $('#loading').style.display = 'block';
  $('#album-art').style.display = 'none';
  $('#track-info').style.visibility = 'hidden';
  $('#track-artists').style.visibility = 'hidden';
  $('.controls').style.visibility = 'hidden';
}

function hideLoading() {
  $('#loading').style.display = 'none';
  $('#album-art').style.display = 'block';
  $('#track-info').style.visibility = 'visible';
  $('#track-artists').style.visibility = 'visible';
  $('.controls').style.visibility = 'visible';
}

function updatePlayer() {
  if (!alreadyPlaying) showLoading();

  chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
    const token = response.token;
    if (!token) {
      $('#loading').textContent = 'Not connected';
      return;
    }
    fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (res.status === 204 || !res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        const isPlaying = data.is_playing;
        const track = data.item;
        $('#track-info').textContent = track.name;
        $('#track-artists').textContent = track.artists.map(a => a.name).join(', ');
        $('#album-art').src = track.album.images[0].url;
        $('#play-pause').textContent = isPlaying ? '⏸️' : '▶️';
        hideLoading();
        alreadyPlaying = true;
      })
      .catch(() => {
        $('#loading').textContent = 'Nothing playing';
      });
  });
}

function control(action) {
  chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
    const token = response.token;
    if (!token) return;
    fetch(`https://api.spotify.com/v1/me/player/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(updatePlayer)
      .catch(() => {});
  });
}

$('#play-pause').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
    const token = response.token;
    if (!token) return;
    fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => control(data.is_playing ? 'pause' : 'play'));
  });
});
$('#next').addEventListener('click', () => control('next'));
$('#prev').addEventListener('click', () => control('previous'));

$('#toggle-button').addEventListener('click', () => {
  container.classList.toggle('collapsed');
  const isCollapsed = container.classList.contains('collapsed');
  $('#toggle-button').textContent = isCollapsed ? '🔼' : '🔽';
  $('#toggle-button').title = isCollapsed ? 'Show player' : 'Hide player';
});

setInterval(updatePlayer, 1000);
updatePlayer();
