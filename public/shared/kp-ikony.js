/* Karta pacienta – SVG ikony místo emotikon (od 0.11.52). Stejná sada a stejný princip jako v PéčeDoma (ikony.js, od 1.76):
   zdrojový kód používá emotikony jako značky (📖 nápověda, 🎨 vzhled, 💬 chat, 📹 videohovor, 🏠 domov, 🏷 štítek …) a tento skript je
   ve vykreslené stránce nahradí jednotnými čárovými ikonami (24×24, tah currentColor – ikona má barvu okolního textu). Funguje i pro
   obsah vykreslený později (sleduje změny DOM). Emotikony v bublinách (title), v <option>, v textových polích a v prvcích s třídou „emo“
   zůstávají. Sdíleno všemi aplikacemi (centrála, karta, Můj průkaz, Průkaz, správa tenantů). */
(function () {
  'use strict';
  const C = (barva) => ({ barva });
  /* symboly: název → vnitřek SVG (viewBox 0 0 24 24, fill none, stroke currentColor 2px) */
  const SYMBOLY = {
    'clipboard': '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h6"/>',
    'eye': '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
    'eye-off': '<path d="M17.9 17.9A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a18.5 18.5 0 0 1 5.1-6M9.9 4.2A9.1 9.1 0 0 1 12 4c7 0 11 7 11 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2"/><path d="M1 1l22 22"/>',
    'phone': '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.6a2 2 0 0 1-.5 2.1L8.1 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.8.3 1.7.6 2.6.7a2 2 0 0 1 1.7 2z"/>',
    'smartphone': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
    'smartphone-in': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/><path d="M9 9.5l3 3 3-3M12 12.5V5.5"/>',
    'link': '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    'stethoscope': '<path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 12 0V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6 6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/>',
    'user': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    'users': '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
    'doctor': '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/><path d="M12 15v6M9.5 18h5"/>',
    'camera': '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    'x': '<path d="M18 6L6 18M6 6l12 12"/>',
    'hospital': '<path d="M3 21V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14"/><path d="M1 21h22"/><path d="M12 8v6M9 11h6"/><path d="M9 21v-4h6v4"/>',
    'save': '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
    'edit': '<path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    'note': '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    'bot': '<rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><path d="M8 16h.01M16 16h.01"/>',
    'download': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
    'upload': '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
    'message': '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    'settings': '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.5a2 2 0 0 1-1 1.8l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.8v-.5a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
    'mail': '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'trash': '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/>',
    'paperclip': '<path d="M21.4 11.1l-9.2 9.2a6 6 0 0 1-8.5-8.5l9.2-9.2a4 4 0 0 1 5.7 5.7l-9.2 9.2a2 2 0 0 1-2.8-2.8l8.5-8.5"/>',
    'check': '<path d="M20 6L9 17l-5-5"/>',
    'check-circle': '<circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>',
    'x-circle': '<circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/>',
    'file': '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
    'search': '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/>',
    'bar-chart': '<path d="M3 3v18h18"/><path d="M7 16v-5M12 16V8M17 16v-3"/>',
    'trend-up': '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
    'trend-down': '<path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
    'dice': '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="8" r="1.3" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="8" cy="16" r="1.3" fill="currentColor" stroke="none"/><circle cx="16" cy="16" r="1.3" fill="currentColor" stroke="none"/>',
    'lock': '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    'key': '<circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6"/><path d="M15.5 7.5l3 3L22 7l-3-3"/>',
    'plug': '<path d="M12 22v-5"/><path d="M9 8V2M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/>',
    'car': '<path d="M19 17h2a1 1 0 0 0 1-1v-3a2 2 0 0 0-1.3-1.9L18 10l-2.4-4.2A2 2 0 0 0 13.9 5H8.3a2 2 0 0 0-1.7.9L4.5 10l-1.9.9A2 2 0 0 0 2 13v3a1 1 0 0 0 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    'dot': '<circle cx="12" cy="12" r="7" fill="currentColor" stroke="none"/>',
    'folder': '<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>',
    'folder-open': '<path d="M6 14l1.5-2.9A2 2 0 0 1 9.3 10H20a2 2 0 0 1 1.9 2.7l-1.4 4A2 2 0 0 1 18.6 18H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.7.9L11 6h7a2 2 0 0 1 2 2v2"/>',
    'alert': '<path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    'book': '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
    'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    'printer': '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    'database': '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
    'flask': '<path d="M10 2v7.5L4.3 19a2 2 0 0 0 1.7 3h12a2 2 0 0 0 1.7-3L14 9.5V2"/><path d="M8.5 2h7"/><path d="M7 15h10"/>',
    'sunrise': '<path d="M12 2v8"/><path d="M4.2 10.2l1.4 1.4M1 18h2M21 18h2M18.4 11.6l1.4-1.4M22 22H2"/><path d="M8 6l4-4 4 4"/><path d="M16 18a4 4 0 0 0-8 0"/>',
    'pill': '<path d="M10.5 20.5l10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7z"/><path d="M8.5 8.5l7 7"/>',
    'calendar': '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    'clock': '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    'refresh': '<path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/>',
    'star': '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
    'building': '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>',
    'map': '<path d="M1 6v16l7-4 8 4 7-4V2l-7 4-8-4z"/><path d="M8 2v16M16 6v16"/>',
    'mic': '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>',
    'sparkles': '<path d="M12 3l2 5.5 5.5 2-5.5 2L12 18l-2-5.5-5.5-2 5.5-2z"/><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z"/>',
    'maximize': '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
    'credit-card': '<rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/>',
    'grid': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    'ban': '<circle cx="12" cy="12" r="10"/><path d="M4.9 4.9l14.2 14.2"/>',
    'arrow-right': '<path d="M5 12h14M12 5l7 7-7 7"/>',
    'arrow-down': '<path d="M12 5v14M5 12l7 7 7-7"/>',
    'arrow-up': '<path d="M12 19V5M5 12l7-7 7 7"/>',
    'send': '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4z"/>',
    'inbox': '<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"/>',
    'activity': '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    'video': '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
    'home': '<path d="M3 11l9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10"/>',
    'tag': '<path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.3" fill="currentColor" stroke="none"/>',
    'image': '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
    'menu': '<path d="M3 6h18M3 12h18M3 18h18"/>',
    'id-card': '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="11" r="2.5"/><path d="M4.5 17a3.5 3.5 0 0 1 7 0"/><path d="M14 9h5M14 13h5"/>',
    'palette': '<circle cx="13.5" cy="6.5" r="1" fill="currentColor" stroke="none"/><circle cx="17.5" cy="10.5" r="1" fill="currentColor" stroke="none"/><circle cx="8.5" cy="7.5" r="1" fill="currentColor" stroke="none"/><circle cx="6.5" cy="12.5" r="1" fill="currentColor" stroke="none"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.9 0 1.6-.7 1.6-1.6 0-.4-.2-.8-.4-1.1-.3-.3-.4-.7-.4-1.1 0-.9.7-1.6 1.6-1.6H16c3.3 0 6-2.7 6-6 0-5-4.5-8.6-10-8.6z"/>',
  };
  /* emotikona → symbol (+ barva, když ji emotikona nese) */
  const MAPA = {
    '📋': 'clipboard', '📝': 'note', '📄': 'file', '📎': 'paperclip', '📁': 'folder', '📂': 'folder-open', '🗂': 'folder', '🗄️': 'database',
    '👁': 'eye', '🙈': 'eye-off', '🔍': 'search',
    '📞': 'phone', '📱': 'smartphone', '📲': 'smartphone-in',
    '🔗': 'link', '🔌': 'plug', '🧩': 'grid', '⚙️': 'settings',
    '🩺': 'stethoscope', '⚕️': 'stethoscope', '👨‍⚕️': 'doctor', '👨': 'user', '👤': 'user', '👥': 'users', '🏥': 'hospital', '💊': 'pill', '🚗': 'car',
    '📷': 'camera', '🎙': 'mic', '🖨': 'printer',
    '✕': 'x', '❌': ['x-circle', '#c0392b'], '⛔': ['ban', '#c0392b'], '✓': 'check', '✔': 'check', '✅': ['check-circle', '#1f9d55'], '⚠': ['alert', '#d9822b'],
    '💾': 'save', '✏️': 'edit', '✎': 'edit', '🗑': 'trash', '➕': 'plus',
    '🤖': 'bot', '✨': 'sparkles', '🧪': 'flask', '🎲': 'dice',
    '⬇': 'download', '⬇️': 'download', '⬆': 'upload', '📤': 'upload', '➤': 'arrow-right',
    '💬': 'message', '📨': 'mail', '✉️': 'mail',
    '📊': 'bar-chart', '📈': 'trend-up', '📉': 'trend-down',
    '🔐': 'lock', '🔑': 'key',
    '📚': 'book', '📖': 'book-open',
    '🌅': 'sunrise', '📅': 'calendar', '🗓️': 'calendar', '🕘': 'clock', '🔁': 'refresh', '🔄': 'refresh',
    '⭐': ['star', '#e0a800'], '🎨': 'palette', '🏢': 'building', '🗺️': 'map', '⛶': 'maximize', '💳': 'credit-card',
    '📹': 'video', '🏠': 'home', '🏷': 'tag', '🖼': 'image', '☰': 'menu', '🪪': 'id-card',
    '🟢': ['dot', '#2fb86b'], '🟡': ['dot', '#f2c227'], '🟠': ['dot', '#f08c1e'], '🔴': ['dot', '#e5484d'], '🔵': ['dot', '#2e86d9'],
  };
  const klice = Object.keys(MAPA).map((k) => k.replace(/️/g, '')).sort((a, b) => b.length - a.length);
  const RX = new RegExp('(' + klice.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')️?', 'g');
  const NORM = {}; Object.keys(MAPA).forEach((k) => { NORM[k.replace(/️/g, '')] = MAPA[k]; });
  const SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, OPTION: 1, TITLE: 1, PRE: 1, CODE: 1, svg: 1, SVG: 1 };
  const NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';

  function sprite() {
    if (document.getElementById('ik-sprite')) return;
    const st = document.createElement('style');
    st.textContent = '.ik{width:1.2em;height:1.2em;vertical-align:-.22em;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;display:inline-block;flex:none;overflow:visible;max-width:none}';
    document.head.appendChild(st);
    const sv = document.createElementNS(NS, 'svg');
    sv.setAttribute('id', 'ik-sprite'); sv.setAttribute('aria-hidden', 'true');
    sv.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
    sv.innerHTML = Object.keys(SYMBOLY).map((k) => '<symbol id="ik-' + k + '" viewBox="0 0 24 24">' + SYMBOLY[k] + '</symbol>').join('');
    document.body.insertBefore(sv, document.body.firstChild);
  }
  function ikona(emo) {
    const def = NORM[emo]; const sym = Array.isArray(def) ? def[0] : def; const barva = Array.isArray(def) ? def[1] : '';
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('class', 'ik ik-' + sym); s.setAttribute('aria-hidden', 'true'); s.setAttribute('data-emo', emo);
    if (barva) s.style.color = barva;
    const u = document.createElementNS(NS, 'use'); u.setAttribute('href', '#ik-' + sym); u.setAttributeNS(XL, 'xlink:href', '#ik-' + sym);
    s.appendChild(u); return s;
  }
  /* prvek s třídou „emo“ (a vše v něm) zůstává s emotikonami – např. dlaždice Info a dashboardy, kde si emotikonu vybírá administrátor */
  function preskocit(el) { for (let e = el; e && e.nodeType === 1; e = e.parentNode) { if (SKIP[e.nodeName] || e.isContentEditable || (e.classList && e.classList.contains('emo'))) return true; } return false; }
  function nahradText(t) {
    const d = t.data; if (!d || !RX.test(d)) { RX.lastIndex = 0; return; }
    RX.lastIndex = 0;
    if (!t.parentNode || preskocit(t.parentNode)) return;
    const fr = document.createDocumentFragment(); let posl = 0, m;
    while ((m = RX.exec(d))) {
      if (m.index > posl) fr.appendChild(document.createTextNode(d.slice(posl, m.index)));
      fr.appendChild(ikona(m[1])); posl = m.index + m[0].length;
    }
    if (posl < d.length) fr.appendChild(document.createTextNode(d.slice(posl)));
    t.parentNode.replaceChild(fr, t);
  }
  function projdi(root) {
    if (!root) return;
    if (root.nodeType === 3) { nahradText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.nodeType === 1 && preskocit(root)) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null), uzly = [];
    while (w.nextNode()) { if (RX.test(w.currentNode.data)) uzly.push(w.currentNode); RX.lastIndex = 0; }
    uzly.forEach(nahradText);
  }
  function start() {
    if (!document.body) return;
    sprite();
    projdi(document.body);
    new MutationObserver((zaznamy) => {
      for (const z of zaznamy) {
        if (z.type === 'characterData') nahradText(z.target);
        else z.addedNodes.forEach(projdi);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  window.KP_IKONY = { SYMBOLY, MAPA, projdi, ikona };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
