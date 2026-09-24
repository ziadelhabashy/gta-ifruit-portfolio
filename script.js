function updateTime() {
  const date = new Date();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = `${hours}:${minutes}`;
}

setInterval(updateTime, 1000);
updateTime();

// Dynamic Title Change on Hover
const appTitle = document.getElementById('app-title');
const tiles = document.querySelectorAll('.tile[data-title]');

tiles.forEach(tile => {
  tile.addEventListener('mouseenter', () => {
    const title = tile.getAttribute('data-title');
    appTitle.textContent = title;
  });

  tile.addEventListener('mouseleave', () => {
    appTitle.textContent = 'Contacts';
  });
});

// ---------- Sounds ----------
// Web Audio instead of <audio> tags: phones (iPhone Safari especially) only
// allow sound after a real tap, and <audio> tags lag on iOS. The unlock tap
// switches the audio context on once; after that both sounds play instantly.
const SOUNDS = {
  notif: { url: 'assets/sounds/ifruit-tap.mp3?v=2', offset: 0.06 },
  touch: { url: 'assets/sounds/touch.mp3?v=2', offset: 0.07 },
};
const SOUND_VOLUME = 0.6;

// let iPhones play site audio even when the ring/silent switch is on silent
try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) {}

const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = AudioCtx ? new AudioCtx() : null;
const soundBuffers = {};

function loadSound(name) {
  return fetch(SOUNDS[name].url)
    .then(res => res.arrayBuffer())
    // callback form of decodeAudioData so older Safari works too
    .then(data => new Promise((ok, fail) => audioCtx.decodeAudioData(data, ok, fail)))
    .then(buffer => { soundBuffers[name] = buffer; })
    .catch(() => {});
}

const soundsReady = audioCtx
  ? Promise.all(Object.keys(SOUNDS).map(loadSound))
  : Promise.resolve();

let soundMuted = false;
try { soundMuted = localStorage.getItem('ifruit-muted') === '1'; } catch (e) {}

function renderSoundToggle() {
  const btn = document.getElementById('sound-toggle');
  btn.classList.toggle('muted', soundMuted);
  const label = soundMuted ? 'Unmute sounds' : 'Mute sounds';
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

function toggleSound() {
  soundMuted = !soundMuted;
  try { localStorage.setItem('ifruit-muted', soundMuted ? '1' : '0'); } catch (e) {}
  renderSoundToggle();
}

renderSoundToggle();

function playSound(name) {
  if (soundMuted || !audioCtx || !soundBuffers[name]) return;
  if (audioCtx.state !== 'running') audioCtx.resume();
  const src = audioCtx.createBufferSource();
  const gain = audioCtx.createGain();
  src.buffer = soundBuffers[name];
  gain.gain.value = SOUND_VOLUME;
  src.connect(gain);
  gain.connect(audioCtx.destination);
  src.start(0, SOUNDS[name].offset);
}

// Touch sound for the 9 app tiles and the home/back buttons (on screen and
// on the phone bezel)
document.querySelectorAll('.tile[data-title], .screen-btn, .hw-btn[onclick]').forEach(el => {
  el.addEventListener('pointerdown', () => playSound('touch'));
});

// Welcome text notification, shown together with its sound on unlock
const welcome = document.getElementById('welcome-notif');
let welcomeTimer;

function hideWelcome() {
  welcome.classList.remove('show');
  clearTimeout(welcomeTimer);
}

function showWelcome() {
  welcome.classList.add('show');
  welcomeTimer = setTimeout(hideWelcome, 9000);
  playSound('notif');
}

welcome.addEventListener('click', hideWelcome);

// Lock screen
const lockScreen = document.getElementById('lock-screen');
document.getElementById('lock-date').textContent =
  new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

function syncLockTime() {
  document.getElementById('lock-time').textContent = document.getElementById('clock').textContent;
}
syncLockTime();
setInterval(syncLockTime, 1000);

lockScreen.addEventListener('click', () => {
  // must happen inside the tap itself, or phones keep audio blocked; older
  // iPhones also need something to actually play, so start a silent blip
  if (audioCtx) {
    if (audioCtx.state !== 'running') audioCtx.resume();
    const blip = audioCtx.createBufferSource();
    blip.buffer = audioCtx.createBuffer(1, 1, 22050);
    blip.connect(audioCtx.destination);
    blip.start(0);
  }
  lockScreen.classList.add('unlocked');
  // on a slow connection wait (briefly) for the sounds, so the notification
  // and its sound still arrive together
  const timeout = new Promise(ok => setTimeout(ok, 1500));
  Promise.race([soundsReady, timeout]).then(showWelcome);
}, { once: true });
lockScreen.focus();

function openApp(pageId) {
  const pages = document.querySelectorAll('.app-page');
  pages.forEach(p => p.classList.remove('active'));

  const targetPage = document.getElementById(pageId);
  if (targetPage) {
    targetPage.classList.add('active');
  }
}

function closeApp() {
  const pages = document.querySelectorAll('.app-page');
  pages.forEach(p => p.classList.remove('active'));
}