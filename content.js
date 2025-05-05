const container = document.createElement('div');
container.id = 'spotify-mini-player';
container.innerHTML = `
  <img id="album-art" src="" alt="Album Art" />
  <div id="track-info">Not playing</div>
  <div class="controls">
    <button id="prev">⏮️</button>
    <button id="play-pause">▶️</button>
    <button id="next">⏭️</button>
  </div>
`;
document.body.appendChild(container);

function updatePlayer() {
    chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
        const token = response.token;
        if (!token) return console.error('Token error:', response.error);
        fetch('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { Authorization: `Bearer ${token}` }
        })
            .then(res => {
                if (res.status === 204 || !res.ok) throw new Error('No content');
                return res.json();
            })
            .then(data => {
                const isPlaying = data.is_playing;
                const track = data.item;
                document.getElementById('track-info').textContent =
                    `${track.name} — ${track.artists.map(a => a.name).join(', ')}`;
                document.getElementById('album-art').src = track.album.images[0].url;
                document.getElementById('play-pause').textContent = isPlaying ? '⏸️' : '▶️';
            })
            .catch(err => console.error(err));
    });
}

function control(action) {
    chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
        const token = response.token;
        if (!token) return console.error('Token error:', response.error);
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
        if (!token) return console.error('Token error:', response.error);
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

setInterval(updatePlayer, 5000);