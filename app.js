/**
 * PASSKEY – Password Generator
 * app.js – Vollständige Logik inkl. Generator, Verlauf, E-Mail Manager
 */

'use strict';

/* =============================================
   KONSTANTEN & ZEICHENSÄTZE
   ============================================= */
const CHARS = {
  upper:   'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lower:   'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  special: '!@#$%^&*()-_=+[]{}|;:,.<>?'
};

// Silben für "aussprechbar"-Modus (Konsonant + Vokal Paare)
const CONSONANTS = ['b','c','d','f','g','h','j','k','l','m','n','p','r','s','t','v','w','x','z','br','ch','cl','cr','dr','fl','fr','gl','gr','kl','kr','pl','pr','qu','sh','sk','sl','sm','sn','sp','st','sw','th','tr','tw','wh'];
const VOWELS    = ['a','e','i','o','u','ai','au','ea','oo','ou'];

const STORAGE_KEYS = {
  settings: 'passkey_settings',
  history:  'passkey_history',
  emails:   'passkey_emails'
};

const MAX_HISTORY = 10;

/* =============================================
   DOM REFERENZEN
   ============================================= */
const dom = {
  lengthSelect:   document.getElementById('length-select'),
  modeRandom:     document.getElementById('mode-random'),
  modePronounce:  document.getElementById('mode-pronounceable'),

  // Sliders + Inputs
  rangeUpper:   document.getElementById('range-upper'),
  rangeLower:   document.getElementById('range-lower'),
  rangeNumbers: document.getElementById('range-numbers'),
  rangeSpecial: document.getElementById('range-special'),
  valUpper:     document.getElementById('val-upper'),
  valLower:     document.getElementById('val-lower'),
  valNumbers:   document.getElementById('val-numbers'),
  valSpecial:   document.getElementById('val-special'),

  // Segments
  segUpper:   document.getElementById('seg-upper'),
  segLower:   document.getElementById('seg-lower'),
  segNumbers: document.getElementById('seg-numbers'),
  segSpecial: document.getElementById('seg-special'),

  totalSum:     document.getElementById('total-sum'),
  totalWarning: document.getElementById('total-warning'),
  btnEqual:     document.getElementById('btn-equal'),

  // Password Display
  pwPlaceholder:  document.getElementById('pw-placeholder'),
  pwText:         document.getElementById('pw-text'),
  strengthFill:   document.getElementById('strength-fill'),
  strengthLabel:  document.getElementById('strength-label'),
  strengthContainer: document.querySelector('.strength-container'),

  btnGenerate: document.getElementById('btn-generate'),
  btnCopy:     document.getElementById('btn-copy'),
  applePwInput: document.getElementById('apple-pw-input'),

  // History
  historyList: document.getElementById('history-list'),

  // Emails
  emailInput:  document.getElementById('email-input'),
  btnAddEmail: document.getElementById('btn-add-email'),
  emailList:   document.getElementById('email-list'),

  toast: document.getElementById('toast')
};

/* =============================================
   ZUSTAND
   ============================================= */
let state = {
  length: 8,
  mode: 'random', // 'random' | 'pronounceable'
  distribution: { upper: 25, lower: 25, numbers: 25, special: 25 },
  currentPassword: '',
  history: [],
  emails: []
};

let toastTimer = null;

/* =============================================
   INITIALISIERUNG
   ============================================= */
function init() {
  loadFromStorage();
  applyStateToUI();
  renderHistory();
  renderEmails();
  bindEvents();
  preventZoom();
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.length)        state.length = s.length;
      if (s.mode)          state.mode = s.mode;
      if (s.distribution)  state.distribution = { ...state.distribution, ...s.distribution };
    }
  } catch(e) {}

  try {
    const h = localStorage.getItem(STORAGE_KEYS.history);
    if (h) state.history = JSON.parse(h);
  } catch(e) {}

  try {
    const e = localStorage.getItem(STORAGE_KEYS.emails);
    if (e) state.emails = JSON.parse(e);
  } catch(e) {}
}

function applyStateToUI() {
  dom.lengthSelect.value = String(state.length);

  if (state.mode === 'pronounceable') {
    dom.modePronounce.checked = true;
  } else {
    dom.modeRandom.checked = true;
  }

  setSliderValues(state.distribution, false);
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
      length: state.length,
      mode: state.mode,
      distribution: state.distribution
    }));
  } catch(e) {}
}

/* =============================================
   EVENTS
   ============================================= */
function bindEvents() {
  // Länge
  dom.lengthSelect.addEventListener('change', () => {
    state.length = parseInt(dom.lengthSelect.value, 10);
    saveSettings();
  });

  // Buchstaben-Modus
  dom.modeRandom.addEventListener('change', () => {
    state.mode = 'random';
    saveSettings();
  });
  dom.modePronounce.addEventListener('change', () => {
    state.mode = 'pronounceable';
    saveSettings();
  });

  // Sliders & Zahlen-Inputs
  const types = ['upper','lower','numbers','special'];
  types.forEach(type => {
    const rangeEl = dom[`range${capitalize(type)}`];
    const valEl   = dom[`val${capitalize(type)}`];

    rangeEl.addEventListener('input', () => {
      const newVal = parseInt(rangeEl.value, 10);
      handleDistributionChange(type, newVal);
    });

    valEl.addEventListener('focus', function() { this.select(); });
    valEl.addEventListener('change', () => {
      let newVal = parseInt(valEl.value, 10);
      if (isNaN(newVal)) newVal = 0;
      newVal = Math.max(0, Math.min(100, newVal));
      handleDistributionChange(type, newVal);
    });
  });

  // GLEICH-Button
  dom.btnEqual.addEventListener('click', distributeEqually);

  // Generieren & Kopieren
  dom.btnGenerate.addEventListener('click', generatePassword);
  dom.btnCopy.addEventListener('click', copyPassword);

  // E-Mail
  dom.btnAddEmail.addEventListener('click', addEmail);
  dom.emailInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addEmail();
  });
}

/* =============================================
   VERTEILUNG / SLIDER LOGIK
   ============================================= */
function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function setSliderValues(dist, save = true) {
  const types = ['upper','lower','numbers','special'];
  types.forEach(type => {
    const v = dist[type] ?? 0;
    dom[`range${capitalize(type)}`].value = v;
    dom[`val${capitalize(type)}`].value = v;
  });
  updateTotalBar();
  if (save) {
    state.distribution = { ...dist };
    saveSettings();
  } else {
    state.distribution = { ...dist };
  }
}

function handleDistributionChange(changedType, newVal) {
  const types = ['upper','lower','numbers','special'];
  const otherTypes = types.filter(t => t !== changedType);

  // Klemme den neuen Wert
  newVal = Math.max(0, Math.min(100, newVal));

  // Aktuelle Summe der anderen
  const otherSum = otherTypes.reduce((s, t) => s + state.distribution[t], 0);
  const remaining = 100 - newVal;

  let newDist = { ...state.distribution, [changedType]: newVal };

  if (otherSum === 0) {
    // Alle anderen sind 0: gleichmäßig verteilen
    const base = Math.floor(remaining / otherTypes.length);
    const remainder = remaining - base * otherTypes.length;
    otherTypes.forEach((t, i) => {
      newDist[t] = base + (i === 0 ? remainder : 0);
    });
  } else {
    // Proportional skalieren
    const scale = remaining / otherSum;
    let tempSum = 0;
    otherTypes.forEach((t, idx) => {
      if (idx < otherTypes.length - 1) {
        newDist[t] = Math.max(0, Math.round(state.distribution[t] * scale));
        tempSum += newDist[t];
      } else {
        newDist[t] = Math.max(0, remaining - tempSum);
      }
    });
  }

  // Exakte Summe sicherstellen
  const total = types.reduce((s, t) => s + newDist[t], 0);
  if (total !== 100) {
    const diff = 100 - total;
    // Erste andere Typ die nicht 0 sind
    const adjustType = otherTypes.find(t => newDist[t] > 0 && newDist[t] + diff >= 0) || changedType;
    newDist[adjustType] = Math.max(0, newDist[adjustType] + diff);
  }

  setSliderValues(newDist);
}

function distributeEqually() {
  const base = Math.floor(100 / 4);
  const rest = 100 - base * 4;
  setSliderValues({
    upper:   base + rest,
    lower:   base,
    numbers: base,
    special: base
  });
}

function updateTotalBar() {
  const d = state.distribution;
  const total = d.upper + d.lower + d.numbers + d.special;

  dom.totalSum.textContent = total;
  dom.totalWarning.textContent = total !== 100 ? `(Ziel: 100%)` : '';

  dom.segUpper.style.width   = `${d.upper}%`;
  dom.segLower.style.width   = `${d.lower}%`;
  dom.segNumbers.style.width = `${d.numbers}%`;
  dom.segSpecial.style.width = `${d.special}%`;
}

/* =============================================
   PASSWORT GENERATOR
   ============================================= */

/**
 * Kryptografisch sichere Zufallszahl 0..n-1
 */
function secureRandom(n) {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return arr[0] % n;
}

/**
 * Wählt zufällig ein Zeichen aus einem String
 */
function pickChar(str) {
  return str[secureRandom(str.length)];
}

/**
 * Generiert ein vollständig aussprechbares Wort einer bestimmten Länge
 * Wechselt Konsonanten und Vokale ab. Fügt manchmal Doppelkonsonanten ein (z. B. 'll', 'ss').
 */
function generatePronounceableWord(wordLength) {
  const singleConsonants = ['b','c','d','f','g','h','j','k','l','m','n','p','r','s','t','v','w','z'];
  const doubleConsonants = ['ll','ss','tt','pp','rr','nn','mm','ff'];
  const vowels = ['a','e','i','o','u'];
  
  let word = "";
  let nextIsVowel = secureRandom(2) === 0;
  
  while (word.length < wordLength) {
    const remaining = wordLength - word.length;
    if (nextIsVowel) {
      word += vowels[secureRandom(vowels.length)];
      nextIsVowel = false;
    } else {
      // Wenn noch genug Platz ist, gibt es eine 20% Chance auf einen Doppelkonsonanten
      if (remaining >= 2 && secureRandom(5) === 0) {
        word += doubleConsonants[secureRandom(doubleConsonants.length)];
      } else {
        word += singleConsonants[secureRandom(singleConsonants.length)];
      }
      nextIsVowel = true;
    }
  }
  return word;
}

/**
 * Hauptgenerator
 */
function generatePassword() {
  const length = state.length;
  const dist   = state.distribution;
  const total  = dist.upper + dist.lower + dist.numbers + dist.special;

  if (total === 0) {
    showToast('⚠ Bitte mindestens einen Zeichentyp aktivieren.');
    return;
  }

  // Zeichen pro Typ berechnen (proportional)
  const counts = computeCounts(length, dist, total);

  let password = "";

  if (state.mode === 'pronounceable') {
    // Aussprechbarer Modus
    const letterCount = counts.upper + counts.lower;
    let word = "";
    if (letterCount > 0) {
      word = generatePronounceableWord(letterCount);
      
      // Groß-/Kleinschreibung passend zur Slider-Einstellung verteilen
      let wordArr = word.split('');
      let indices = Array.from({length: wordArr.length}, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = secureRandom(i + 1);
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      for (let i = 0; i < counts.upper; i++) {
        if (indices[i] !== undefined) {
          wordArr[indices[i]] = wordArr[indices[i]].toUpperCase();
        }
      }
      word = wordArr.join('');
    }

    // Zahlen und Sonderzeichen vorbereiten
    let nonLetters = [];
    for (let i = 0; i < counts.numbers; i++) nonLetters.push(pickChar(CHARS.numbers));
    for (let i = 0; i < counts.special; i++) nonLetters.push(pickChar(CHARS.special));
    
    // Zahlen und Sonderzeichen untereinander mischen
    for (let i = nonLetters.length - 1; i > 0; i--) {
      const j = secureRandom(i + 1);
      [nonLetters[i], nonLetters[j]] = [nonLetters[j], nonLetters[i]];
    }

    // Zahlen/Sonderzeichen zufällig aufteilen (vorne, hinten oder geteilt)
    const splitIdx = secureRandom(nonLetters.length + 1);
    const prefix = nonLetters.slice(0, splitIdx).join('');
    const suffix = nonLetters.slice(splitIdx).join('');

    password = prefix + word + suffix;
  } else {
    // Zufälliger Modus
    let chars = [];
    for (let i = 0; i < counts.upper;   i++) chars.push(pickChar(CHARS.upper));
    for (let i = 0; i < counts.lower;   i++) chars.push(pickChar(CHARS.lower));
    for (let i = 0; i < counts.numbers; i++) chars.push(pickChar(CHARS.numbers));
    for (let i = 0; i < counts.special; i++) chars.push(pickChar(CHARS.special));

    // Länge exakt anpassen
    while (chars.length < length) chars.push(pickChar(CHARS.lower));
    chars = chars.slice(0, length);

    // Zufällig durchmischen (Fisher-Yates)
    for (let i = chars.length - 1; i > 0; i--) {
      const j = secureRandom(i + 1);
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    password = chars.join('');
  }

  state.currentPassword = password;

  displayPassword(password);
  updateStrength(password);
  addToHistory(password);

  // Apple Password Manager befüllen
  dom.applePwInput.value = password;
}

/**
 * Anzahl der Zeichen pro Typ berechnen
 */
function computeCounts(length, dist, total) {
  const types = ['upper','lower','numbers','special'];
  let counts = {};
  let assigned = 0;

  types.forEach((t, idx) => {
    if (idx < types.length - 1) {
      counts[t] = Math.round((dist[t] / total) * length);
      assigned += counts[t];
    } else {
      counts[t] = Math.max(0, length - assigned);
    }
  });

  return counts;
}

/* =============================================
   ANZEIGE
   ============================================= */
function displayPassword(pw) {
  dom.pwPlaceholder.style.display = 'none';
  dom.pwText.textContent = pw;
  dom.pwText.classList.add('visible');

  // Animiertes Erscheinen
  dom.pwText.style.opacity = '0';
  dom.pwText.style.transform = 'scale(0.96)';
  requestAnimationFrame(() => {
    dom.pwText.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    dom.pwText.style.opacity = '1';
    dom.pwText.style.transform = 'scale(1)';
  });

  dom.btnCopy.disabled = false;
}

/* =============================================
   PASSWORTSTÄRKE
   ============================================= */
function updateStrength(pw) {
  let score = 0;
  const len = pw.length;

  // Länge
  if (len >= 6)  score++;
  if (len >= 8)  score++;
  if (len >= 10) score++;
  if (len >= 12) score++;

  // Zeichenvielfalt
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  // Keine Wiederholungen
  const unique = new Set(pw.split('')).size;
  if (unique / len > 0.7) score++;

  const container = dom.strengthContainer;
  container.className = 'strength-container';

  if (score <= 3) {
    container.classList.add('strength-weak');
    dom.strengthLabel.textContent = 'SCHWACH';
  } else if (score <= 5) {
    container.classList.add('strength-fair');
    dom.strengthLabel.textContent = 'MÄSSIG';
  } else if (score <= 7) {
    container.classList.add('strength-strong');
    dom.strengthLabel.textContent = 'STARK';
  } else {
    container.classList.add('strength-vstrong');
    dom.strengthLabel.textContent = 'SEHR STARK';
  }
}

/* =============================================
   KOPIEREN
   ============================================= */
async function copyPassword() {
  if (!state.currentPassword) return;

  try {
    await navigator.clipboard.writeText(state.currentPassword);
    showToast('✓ Passwort kopiert!');

    // Button Feedback
    const original = dom.btnCopy.innerHTML;
    dom.btnCopy.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      KOPIERT
    `;
    dom.btnCopy.style.borderColor = 'var(--clr-neon-green)';
    dom.btnCopy.style.color = 'var(--clr-neon-green)';

    setTimeout(() => {
      dom.btnCopy.innerHTML = original;
      dom.btnCopy.style.borderColor = '';
      dom.btnCopy.style.color = '';
    }, 1800);

  } catch(e) {
    // Fallback für ältere Browser
    try {
      dom.applePwInput.removeAttribute('readonly');
      dom.applePwInput.select();
      document.execCommand('copy');
      dom.applePwInput.setAttribute('readonly', '');
      showToast('✓ Passwort kopiert!');
    } catch(e2) {
      showToast('⚠ Kopieren nicht möglich.');
    }
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch(e) {
    return false;
  }
}

/* =============================================
   VERLAUF (HISTORY)
   ============================================= */
function addToHistory(pw) {
  const entry = {
    pw,
    time: new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  };

  state.history.unshift(entry);
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(0, MAX_HISTORY);
  }

  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
  } catch(e) {}

  renderHistory();
}

function renderHistory() {
  const list = dom.historyList;
  list.innerHTML = '';

  if (state.history.length === 0) {
    list.innerHTML = '<p class="history-empty">Noch keine Passwörter generiert.</p>';
    return;
  }

  state.history.forEach((entry, idx) => {
    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('data-idx', idx);

    item.innerHTML = `
      <span class="history-pw" title="${escapeHtml(entry.pw)}">${escapeHtml(entry.pw)}</span>
      <span class="history-time">${escapeHtml(entry.time)}</span>
      <button class="btn-history-copy" aria-label="Passwort ${idx + 1} kopieren">KOPIEREN</button>
    `;

    item.querySelector('.btn-history-copy').addEventListener('click', async () => {
      const ok = await copyText(entry.pw);
      showToast(ok ? '✓ Kopiert!' : '⚠ Fehler');
    });

    list.appendChild(item);
  });
}

/* =============================================
   E-MAIL MANAGER
   ============================================= */
function addEmail() {
  const val = dom.emailInput.value.trim();
  if (!val) return;

  if (!isValidEmail(val)) {
    showToast('⚠ Ungültige E-Mail-Adresse.');
    return;
  }

  if (state.emails.includes(val)) {
    showToast('ℹ E-Mail bereits gespeichert.');
    return;
  }

  state.emails.push(val);
  saveEmails();
  renderEmails();
  dom.emailInput.value = '';
  showToast('✓ E-Mail gespeichert!');
}

function deleteEmail(idx) {
  state.emails.splice(idx, 1);
  saveEmails();
  renderEmails();
  showToast('✓ E-Mail entfernt.');
}

function saveEmails() {
  try {
    localStorage.setItem(STORAGE_KEYS.emails, JSON.stringify(state.emails));
  } catch(e) {}
}

function renderEmails() {
  const list = dom.emailList;
  list.innerHTML = '';

  if (state.emails.length === 0) {
    list.innerHTML = '<p class="email-empty">Noch keine E-Mail-Adressen gespeichert.</p>';
    return;
  }

  state.emails.forEach((email, idx) => {
    const item = document.createElement('div');
    item.className = 'email-item';

    item.innerHTML = `
      <span class="email-addr" title="${escapeHtml(email)}">${escapeHtml(email)}</span>
      <button class="btn-email-copy" aria-label="E-Mail kopieren">KOPIEREN</button>
      <button class="btn-email-delete" aria-label="E-Mail löschen">✕</button>
    `;

    item.querySelector('.btn-email-copy').addEventListener('click', async () => {
      const ok = await copyText(email);
      showToast(ok ? '✓ E-Mail kopiert!' : '⚠ Fehler');
    });

    item.querySelector('.btn-email-delete').addEventListener('click', () => {
      deleteEmail(idx);
    });

    list.appendChild(item);
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* =============================================
   TOAST
   ============================================= */
function showToast(msg) {
  if (toastTimer) clearTimeout(toastTimer);
  dom.toast.textContent = msg;
  dom.toast.classList.add('show');
  toastTimer = setTimeout(() => {
    dom.toast.classList.remove('show');
  }, 2400);
}

/* =============================================
   ZOOM PREVENTION
   ============================================= */
function preventZoom() {
  // Prevent gesture-based zoom
  document.addEventListener('gesturestart', e => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', e => e.preventDefault(), { passive: false });

  // Prevent ctrl+wheel zoom
  document.addEventListener('wheel', e => {
    if (e.ctrlKey) e.preventDefault();
  }, { passive: false });

  // Prevent double-tap zoom (except inputs)
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTouch < 300 && !e.target.matches('input, textarea, select')) {
      e.preventDefault();
    }
    lastTouch = now;
  }, { passive: false });
}

/* =============================================
   UTILS
   ============================================= */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* =============================================
   START
   ============================================= */
document.addEventListener('DOMContentLoaded', init);
