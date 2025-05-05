const container = document.createElement('div');
container.id = 'spotify-mini-player';
// loading screen:
container.innerHTML = `
  <div id="loading">Loading…</div>
  <img id="album-art" src="" alt="Album Art" style="display:none;" />
  <div id="track-info" style="visibility:hidden;">Not playing</div>
  <div class="controls" style="visibility:hidden;">
    <button id="prev">⏮️</button>
    <button id="play-pause">▶️</button>
    <button id="next">⏭️</button>
  </div>
`;
document.body.appendChild(container);

let alreadyPlaying = false;

function showLoading() {
  document.getElementById('loading').style.display = 'block';
  document.getElementById('album-art').style.display = 'none';
  document.getElementById('track-info').style.visibility = 'hidden';
  document.querySelector('.controls').style.visibility = 'hidden';
}

function hideLoading() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('album-art').style.display = 'block';
  document.getElementById('track-info').style.visibility = 'visible';
  document.querySelector('.controls').style.visibility = 'visible';
}

function updatePlayer() {
    if(!alreadyPlaying) {
        showLoading();
    }

  chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
    const token = response.token;
    if (!token) {
      console.error('Token error:', response.error);
      document.getElementById('loading').textContent = 'Not connected';
      return;
    }

    fetch('https://api.spotify.com/v1/me/player/currently-playing', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => {
        if (res.status === 204 || !res.ok) {
          throw new Error('No content');
        }
        return res.json();
      })
      .then(data => {
        const isPlaying = data.is_playing;
        const track = data.item;

        document.getElementById('track-info').textContent =
          `${track.name} — ${track.artists.map(a => a.name).join(', ')}`;
        document.getElementById('album-art').src = track.album.images[0].url;
        document.getElementById('play-pause').textContent = isPlaying ? '⏸️' : '▶️';

        hideLoading();
        alreadyPlaying = true;
      })
      .catch(err => {
        console.error(err);
        document.getElementById('loading').textContent = 'Nothing playing';
      });
  });
}

function control(action) {
  chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
    const token = response.token;
    if (!token) {
      console.error('Token error:', response.error);
      return;
    }
    fetch(`https://api.spotify.com/v1/me/player/${action}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(updatePlayer)
      .catch(err => console.error(err));
  });
}

document.getElementById('play-pause').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
    const token = response.token;
    if (!token) {
      console.error('Token error:', response.error);
      return;
    }
    fetch('https://api.spotify.com/v1/me/player', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => control(data.is_playing ? 'pause' : 'play'))
      .catch(err => console.error(err));
  });
});
document.getElementById('next').addEventListener('click', () => control('next'));
document.getElementById('prev').addEventListener('click', () => control('previous'));

setInterval(updatePlayer, 1000);

updatePlayer();
