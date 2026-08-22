import re

with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/onjn.js', 'r') as f:
    js = f.read()

# Replace any native alerts that were generated before, though we only had one left from the mock submit
js = js.replace("alert('Datele au fost salvate (mock).')", "showOnjnToast('Datele au fost salvate cu succes!')")
js = js.replace("alert('Funcționalitate în lucru...')", "showOnjnToast('Datele au fost salvate cu succes!')")

toast_js = """
// ==========================================
// TOAST NOTIFICATIONS
// ==========================================
window.showOnjnToast = function(message) {
  const existing = document.getElementById('onjn-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'onjn-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--surface2, #1a2235);
    color: var(--text, #fff);
    padding: 12px 24px;
    border-radius: 8px;
    border: 1px solid var(--border, rgba(255,255,255,0.1));
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
    z-index: 999999;
    font-size: 13px;
    font-weight: 500;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s ease;
    display: flex;
    align-items: center;
    gap: 12px;
  `;
  
  toast.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--green, #10b981);">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);
  
  // trigger animation
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(20px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};
"""

js = js.replace("// ==========================================\n// MODALS", toast_js + "\n// ==========================================\n// MODALS")

with open('/Users/eugeniucazmal/Downloads/dev_office/cashpot2/onjn.js', 'w') as f:
    f.write(js)

