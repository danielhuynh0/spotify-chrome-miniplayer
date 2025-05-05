document.addEventListener('DOMContentLoaded', () => {
    const statusEl = document.getElementById('status');
    const buttonEl = document.getElementById('connect');

    // check the current connection if it is already connected
    chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
        if (response.token) {
            statusEl.textContent = 'Connected';
            buttonEl.disabled = true;

            // get current tab of current window (basically just the one that is active)
            // load the mini player window into our current tab
            chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
                chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    files: ['content.js']
                });
                chrome.scripting.insertCSS({
                    target: { tabId: tab.id },
                    files: ['styles.css']
                });
            });
        }
    });

    buttonEl.addEventListener('click', () => {
        chrome.runtime.sendMessage({ action: 'getAccessToken' }, response => {
            if (response.token) {
                statusEl.textContent = 'Connected';
                buttonEl.disabled = true;
            } else {
                statusEl.textContent = 'Error: ' + (response.error || 'Unknown');
            }
        });
    });
});
