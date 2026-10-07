// Shared client-side helper. Sends captures to /save (local server).
function saveCapture(site, category, type, data, page) {
  const payload = { site, category, type, data, page: page || '' };
  fetch('/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(e => console.error('save error', e));
}
function notifyLanding(site, category, page) {
  saveCapture(site, category, 'VISIT', { page: page }, page);
}
