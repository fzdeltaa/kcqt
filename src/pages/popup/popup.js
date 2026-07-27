const toggle = document.getElementById('intercept-toggle');

chrome.storage.local.get('enabled', (result = {}) => {
  toggle.checked = result.enabled || false;
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});

document.getElementById('open-tracker-btn').addEventListener('click', () => {
  window.open(chrome.runtime.getURL('pages/tracker/index.html'));
});