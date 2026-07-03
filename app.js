/**
 * Passwort-Generator – Password Generator
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
  avoidSimilar:   document.getElementById('avoid-similar'),
  btnMenu:        document.getElementById('btn-menu'),
  btnCloseMenu:   document.getElementById('btn-close-menu'),
  overlay:        document.getElementById('settings-overlay'),
  settingsPanel:  document.getElementById('settings-panel'),
  btnHeaderGen:   document.getElementById('btn-header-gen'),

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
  totalTarget:  document.getElementById('total-target'),
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
  avoidSimilar: false,
  distribution: { upper: 2, lower: 2, numbers: 2, special: 2 },
  recencyHistory: ['upper', 'lower', 'numbers', 'special'],
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
  initSwipeGestures();
  preventZoom();
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.settings);
    if (raw) {
      const s = JSON.parse(raw);
      if (s.length)        state.length = s.length;
      if (s.mode)          state.mode = s.mode;
      if (s.avoidSimilar !== undefined) state.avoidSimilar = s.avoidSimilar;
      if (s.distribution) {
        const sum = s.distribution.upper + s.distribution.lower + s.distribution.numbers + s.distribution.special;
        if (sum === state.length) {
          state.distribution = s.distribution;
        } else {
          // Gleichmäßig für Standardlänge verteilen
          const base = Math.floor(state.length / 4);
          const rest = state.length - base * 4;
          state.distribution = {
            upper: base + rest,
            lower: base,
            numbers: base,
            special: base
          };
        }
      }
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

  dom.avoidSimilar.checked = state.avoidSimilar;

  setSliderValues(state.distribution, false);
}

function saveSettings() {
  try {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify({
      length: state.length,
      mode: state.mode,
      avoidSimilar: state.avoidSimilar,
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
    const val = parseInt(dom.lengthSelect.value, 10);
    adjustToNewLength(val);
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

  // 0/O vermeiden Checkbox
  dom.avoidSimilar.addEventListener('change', () => {
    state.avoidSimilar = dom.avoidSimilar.checked;
    saveSettings();
  });

  // Mobile Menü-Steuerung & Schnell-Generierung
  dom.btnMenu.addEventListener('click', openMenu);
  dom.btnCloseMenu.addEventListener('click', closeMenu);
  dom.overlay.addEventListener('click', closeMenu);
  dom.btnHeaderGen.addEventListener('click', generatePassword);

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
    valEl.addEventListener('click', function() { this.select(); });
    valEl.addEventListener('change', () => {
      let newVal = parseInt(valEl.value, 10);
      if (isNaN(newVal)) newVal = 0;
      newVal = Math.max(0, Math.min(state.length, newVal));
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
    const rangeEl = dom[`range${capitalize(type)}`];
    const valEl   = dom[`val${capitalize(type)}`];
    
    rangeEl.min = 0;
    rangeEl.max = state.length;
    rangeEl.value = v;
    
    valEl.min = 0;
    valEl.max = state.length;
    valEl.value = v;
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
  newVal = Math.max(0, Math.min(state.length, newVal));
  const oldVal = state.distribution[changedType];
  const diff = newVal - oldVal;
  
  if (diff === 0) return;
  
  state.distribution[changedType] = newVal;
  
  // Aktualisiere recencyHistory: verschiebe changedType an die Spitze
  state.recencyHistory = [changedType, ...state.recencyHistory.filter(t => t !== changedType)];
  
  // Liste der anderen Typen, sortiert nach dem am längsten nicht angefassten (reverse recencyHistory)
  const otherTypes = [...state.recencyHistory].reverse().filter(t => t !== changedType);
  let remainingCompensate = -diff;
  
  for (const t of otherTypes) {
    if (remainingCompensate === 0) break;
    const val = state.distribution[t];
    
    if (remainingCompensate < 0) {
      // Wir müssen andere Werte verringern
      const decreaseBy = Math.min(val, -remainingCompensate);
      state.distribution[t] -= decreaseBy;
      remainingCompensate += decreaseBy;
    } else {
      // Wir müssen andere Werte erhöhen (die Summe darf state.length nicht überschreiten)
      const maxPossible = state.length - Object.values(state.distribution).reduce((a, b) => a + b, 0) + state.distribution[t];
      const increaseBy = Math.min(maxPossible - val, remainingCompensate);
      state.distribution[t] += increaseBy;
      remainingCompensate -= increaseBy;
    }
  }
  
  // Mathematische Absicherung: Falls Rest verbleibt, passe den Auslöser selbst an
  if (remainingCompensate !== 0) {
    state.distribution[changedType] += remainingCompensate;
  }
  
  setSliderValues(state.distribution);
}

function adjustToNewLength(newLength) {
  const oldLength = state.length;
  state.length = newLength;
  
  let diff = newLength - oldLength;
  if (diff === 0) return;
  
  // Passe die am längsten nicht berührten Slider zuerst an
  const types = [...state.recencyHistory].reverse();
  for (const t of types) {
    if (diff === 0) break;
    const val = state.distribution[t];
    if (diff > 0) {
      state.distribution[t] += diff;
      diff = 0;
    } else {
      const decreaseBy = Math.min(val, -diff);
      state.distribution[t] -= decreaseBy;
      diff += decreaseBy;
    }
  }
  
  setSliderValues(state.distribution);
}

function distributeEqually() {
  const base = Math.floor(state.length / 4);
  const rest = state.length - base * 4;
  
  const nextDist = {
    upper: base,
    lower: base,
    numbers: base,
    special: base
  };
  
  // Verteile den Rest auf die am kürzesten bearbeiteten Slider (historisch)
  const keys = ['upper', 'lower', 'numbers', 'special'];
  for (let i = 0; i < rest; i++) {
    nextDist[keys[i]]++;
  }
  
  setSliderValues(nextDist);
}

function updateTotalBar() {
  const d = state.distribution;
  const total = d.upper + d.lower + d.numbers + d.special;

  dom.totalSum.textContent = total;
  dom.totalTarget.textContent = state.length;
  dom.totalWarning.textContent = total !== state.length ? `(Ziel: ${state.length})` : '';

  const pctUpper = state.length > 0 ? (d.upper / state.length) * 100 : 0;
  const pctLower = state.length > 0 ? (d.lower / state.length) * 100 : 0;
  const pctNumbers = state.length > 0 ? (d.numbers / state.length) * 100 : 0;
  const pctSpecial = state.length > 0 ? (d.special / state.length) * 100 : 0;

  dom.segUpper.style.width   = `${pctUpper}%`;
  dom.segLower.style.width   = `${pctLower}%`;
  dom.segNumbers.style.width = `${pctNumbers}%`;
  dom.segSpecial.style.width = `${pctSpecial}%`;
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
  let singleConsonants = ['b','c','d','f','g','h','j','k','l','m','n','p','r','s','t','v','w','z'];
  let doubleConsonants = ['ll','ss','tt','pp','rr','nn','mm','ff'];
  let vowels = ['a','e','i','o','u'];
  
  if (state.avoidSimilar) {
    // Vermeide verwechslungsanfällige Zeichen:
    // 'l' wird entfernt (sieht aus wie 1/I)
    singleConsonants = singleConsonants.filter(c => c !== 'l');
    doubleConsonants = doubleConsonants.filter(c => !c.includes('l'));
    // 'o' (0) und 'i' (I/1) werden aus den Vokalen entfernt
    vowels = vowels.filter(v => v !== 'o' && v !== 'i');
  }
  
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

  // Nutze die absolute Verteilung direkt
  const counts = state.distribution;

  // Zeichensätze filtern falls avoidSimilar aktiv ist
  let charUpper = CHARS.upper;
  let charLower = CHARS.lower;
  let charNumbers = CHARS.numbers;
  let charSpecial = CHARS.special;

  if (state.avoidSimilar) {
    const removeSet = ['0', 'O', 'o', 'I', 'i', 'l', '1'];
    charUpper = charUpper.split('').filter(c => !removeSet.includes(c)).join('');
    charLower = charLower.split('').filter(c => !removeSet.includes(c)).join('');
    charNumbers = charNumbers.split('').filter(c => !removeSet.includes(c)).join('');
    charSpecial = charSpecial.split('').filter(c => !removeSet.includes(c)).join('');
  }

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
    for (let i = 0; i < counts.numbers; i++) nonLetters.push(pickChar(charNumbers));
    for (let i = 0; i < counts.special; i++) nonLetters.push(pickChar(charSpecial));
    
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
    for (let i = 0; i < counts.upper;   i++) chars.push(pickChar(charUpper));
    for (let i = 0; i < counts.lower;   i++) chars.push(pickChar(charLower));
    for (let i = 0; i < counts.numbers; i++) chars.push(pickChar(charNumbers));
    for (let i = 0; i < counts.special; i++) chars.push(pickChar(charSpecial));

    // Länge exakt anpassen
    while (chars.length < length) chars.push(pickChar(charLower));
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

function deleteHistoryItem(idx) {
  state.history.splice(idx, 1);
  try {
    localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(state.history));
  } catch(e) {}
  renderHistory();
  showToast('✓ Passwort gelöscht.');
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
      <button class="btn-history-delete" aria-label="Passwort ${idx + 1} löschen">✕</button>
    `;

    item.querySelector('.btn-history-copy').addEventListener('click', async () => {
      const ok = await copyText(entry.pw);
      showToast(ok ? '✓ Kopiert!' : '⚠ Fehler');
    });

    item.querySelector('.btn-history-delete').addEventListener('click', () => {
      deleteHistoryItem(idx);
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
   MOBILE MENU & GESTURES
   ============================================= */
function openMenu() {
  dom.settingsPanel.classList.add('open');
  dom.overlay.classList.add('open');
}

function closeMenu() {
  dom.settingsPanel.classList.remove('open');
  dom.overlay.classList.remove('open');
}

function initSwipeGestures() {
  let touchStartX = 0;
  let touchStartY = 0;

  document.addEventListener('touchstart', (e) => {
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;

    // Nur horizontale Wischgesten auswerten, wenn sie dominant sind (dx > dy) und eine Mindestdistanz haben (60px)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 60) {
      const isPanelOpen = dom.settingsPanel.classList.contains('open');

      if (!isPanelOpen) {
        // Wischgeste von rechts nach links: Prüfe ob Startpunkt am rechten Rand lag (letzte 40px)
        const screenWidth = window.innerWidth;
        if (deltaX < 0 && (screenWidth - touchStartX) < 40) {
          openMenu();
        }
      } else {
        // Wischgeste von links nach rechts: Darf nur auslösen, wenn sie am linken Rand des Drawer-Panels beginnt
        // Das Panel ist auf der rechten Seite. Seine X-Position des linken Rands ist: ScreenWidth - PanelWidth.
        const panelWidth = dom.settingsPanel.offsetWidth;
        const panelLeftX = window.innerWidth - panelWidth;

        // Wenn der Touchstart nahe dem linken Rand des Panels lag (z.B. innerhalb der ersten 40px ab Panel-Beginn)
        if (deltaX > 0 && touchStartX >= panelLeftX && touchStartX <= (panelLeftX + 40)) {
          closeMenu();
        }
      }
    }
  }, { passive: true });
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
