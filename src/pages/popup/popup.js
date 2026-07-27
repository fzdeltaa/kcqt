const toggle = document.getElementById('intercept-toggle');

chrome.storage.local.get('enabled', (result = {}) => {
  const isEnabled = typeof result.enabled === 'boolean' ? result.enabled : true;
  toggle.checked = isEnabled;
  if (typeof result.enabled !== 'boolean') {
    chrome.storage.local.set({ enabled: true });
  }
});

toggle.addEventListener('change', () => {
  chrome.storage.local.set({ enabled: toggle.checked });
});

document.getElementById('open-tracker-btn').addEventListener('click', () => {
  window.open(chrome.runtime.getURL('pages/tracker/index.html'));
});