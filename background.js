const manifest = chrome.runtime.getManifest();
const CLIENT_ID = manifest.oauth2.client_id;
const SCOPES = manifest.oauth2.scopes.join(' ');
const REDIRECT_URI = chrome.identity.getRedirectURL();

// apparently spotify requires a code challenge now to do api calls?
function generateCodeVerifier(length = 64) {
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    return base64UrlEncode(array);
}

// encode the verifier
function base64UrlEncode(buffer) {
    const str = String.fromCharCode(...new Uint8Array(buffer));
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function generateCodeChallenge(verifier) {
    const data = new TextEncoder().encode(verifier);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
}

async function getSpotifyTokenWithPKCE() {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const authUrl =
        `https://accounts.spotify.com/authorize?` +
        `client_id=${encodeURIComponent(CLIENT_ID)}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(SCOPES)}` +
        `&code_challenge_method=S256` +
        `&code_challenge=${encodeURIComponent(challenge)}`;

    return new Promise((resolve, reject) => {
        console.log('Auth URL:', authUrl);
        
        chrome.identity.launchWebAuthFlow(
            { url: authUrl, interactive: true },
            async (callbackUrl) => {
                if (chrome.runtime.lastError || !callbackUrl) {
                    return reject(chrome.runtime.lastError || new Error('Authorization failed'));
                }
                const url = new URL(callbackUrl);
                const code = url.searchParams.get('code');
                if (!code) {
                    const err = url.searchParams.get('error') || 'No code returned';
                    return reject(new Error(err));
                }
                try {
                    const resp = await fetch('https://accounts.spotify.com/api/token', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                        body: new URLSearchParams({
                            grant_type: 'authorization_code',
                            code,
                            redirect_uri: REDIRECT_URI,
                            client_id: CLIENT_ID,
                            code_verifier: verifier
                        })
                    });
                    if (!resp.ok) throw new Error(`Token exchange failed: ${await resp.text()}`);
                    resolve(await resp.json());
                } catch (e) {
                    reject(e);
                }
            }
        );
    });
}

async function refreshSpotifyToken(refreshToken) {
    const resp = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: CLIENT_ID
        })
    });
    if (!resp.ok) throw new Error(`Refresh failed: ${await resp.text()}`);
    return await resp.json();
}


async function getValidAccessToken() {
    const store = await chrome.storage.local.get([
        'spotify_access_token',
        'spotify_refresh_token',
        'spotify_expiry'
    ]);
    const now = Date.now();
    if (store.spotify_access_token && store.spotify_expiry > now) {
        return store.spotify_access_token;
    }

    let tokenData;
    if (store.spotify_refresh_token) {
        tokenData = await refreshSpotifyToken(store.spotify_refresh_token);
    } else {
        tokenData = await getSpotifyTokenWithPKCE();
    }
    const expiryTime = Date.now() + tokenData.expires_in * 1000;
    
    const toStore = {
        spotify_access_token: tokenData.access_token,
        spotify_expiry: expiryTime
    };
    if (tokenData.refresh_token) {
        toStore.spotify_refresh_token = tokenData.refresh_token;
    }
    await chrome.storage.local.set(toStore);

    return tokenData.access_token;
}

// listener that is used in the other scripts for getting an access token
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'getAccessToken') {
        getValidAccessToken()
            .then(token => sendResponse({ token }))
            .catch(error => sendResponse({ error: error.message }));
        return true;
    }
});
