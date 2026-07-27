document.getElementById('open-tracker-btn').addEventListener('click', () => {
  window.open(chrome.runtime.getURL('pages/tracker/index.html'));
});