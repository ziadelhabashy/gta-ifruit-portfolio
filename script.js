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
// Untrimmed original files (trimmed MP3s wouldn't decode on iPhone); the
// silence before each sound is skipped here instead with offset/duration.
const SOUNDS = {
  notif: { url: 'assets/sounds/ifruit-tap.mp3?v=3', offset: 0.19 },
  touch: { url: 'assets/sounds/touch.mp3?v=3', offset: 0.59, duration: 0.2 },
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

// backup for browsers that can't decode a file with Web Audio
function playWithAudioTag(name) {
  const tag = new Audio(SOUNDS[name].url);
  tag.volume = SOUND_VOLUME;
  tag.currentTime = SOUNDS[name].offset;
  tag.play().catch(() => {});
}

function playSound(name) {
  if (soundMuted) return;
  if (!audioCtx || !soundBuffers[name]) {
    playWithAudioTag(name);
    return;
  }
  const start = () => {
    const src = audioCtx.createBufferSource();
    const gain = audioCtx.createGain();
    src.buffer = soundBuffers[name];
    gain.gain.value = SOUND_VOLUME;
    src.connect(gain);
    gain.connect(audioCtx.destination);
    const { offset, duration } = SOUNDS[name];
    if (duration) src.start(0, offset, duration);
    else src.start(0, offset);
  };
  // audio can still be waking up right after the unlock; wait for it rather
  // than dropping the sound
  if (audioCtx.state === 'running') start();
  else audioCtx.resume().then(start).catch(() => {});
}

// Touch sound for the 9 app tiles and the home/back buttons (on screen and
// on the phone bezel)
document.querySelectorAll('.tile[data-title], .screen-btn, .hw-btn[onclick]').forEach(el => {
  el.addEventListener('pointerdown', () => playSound('touch'));
});

// Missed calls waiting on the lock screen
const LOCK_CALLS = [
  { name: 'Siemens', avatar: 'S', bg: '#009999', fg: '#fff' },
  { name: 'Valeo', avatar: 'V', bg: '#82e600', fg: '#1b1b1b' },
  { name: 'PwC', avatar: 'pwc', bg: '#d04a02', fg: '#fff' },
  { name: 'Deloitte', avatar: 'D<span class="call-dot"></span>', bg: '#000', fg: '#fff' },
];

const lockNotifs = document.getElementById('lock-notifs');
LOCK_CALLS.forEach((call, i) => {
  const row = document.createElement('div');
  row.className = 'lock-notif';
  row.style.animationDelay = (0.4 + i * 0.35) + 's';
  row.innerHTML =
    '<div class="call-avatar" style="background:' + call.bg + ';color:' + call.fg + ';">' + call.avatar + '</div>' +
    '<div class="lock-notif-text"><b>' + call.name + '</b><span>Missed Call</span></div>' +
    '<span class="lock-notif-time">now</span>';
  lockNotifs.appendChild(row);
});

// Inside, after unlocking: the welcome text, then a missed call from Google.
// Tap either to dismiss it.
const welcome = document.getElementById('welcome-notif');
const googleCall = document.getElementById('call-google');

function showNotif(el) {
  el.classList.remove('leaving');
  el.classList.add('show');
}

function hideNotif(el) {
  if (!el.classList.contains('show') || el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  setTimeout(() => el.classList.remove('show', 'leaving'), 300);
}

function showWelcome() {
  showNotif(welcome);
  playSound('notif');
  setTimeout(() => {
    showNotif(googleCall);
    playSound('notif');
  }, 1200);
  setTimeout(() => hideNotif(welcome), 9000);
  setTimeout(() => hideNotif(googleCall), 9150);
}

[welcome, googleCall].forEach(el => el.addEventListener('click', () => hideNotif(el)));

// Lock screen: drag the knob to the end of the track to unlock
const lockScreen = document.getElementById('lock-screen');
const sliderTrack = document.getElementById('slider-track');
const sliderKnob = document.getElementById('slider-knob');

function syncLockClock() {
  const now = new Date();
  const h = now.getHours() % 12 || 12;
  document.getElementById('lock-time').textContent = h + ':' + String(now.getMinutes()).padStart(2, '0');
  const weekday = now.toLocaleDateString('en-GB', { weekday: 'long' });
  const dayMonth = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });
  document.getElementById('lock-date').textContent = weekday + ', ' + dayMonth;
}
syncLockClock();
setInterval(syncLockClock, 1000);

// has to run inside the gesture itself, or phones keep audio blocked; older
// iPhones also need something to actually play, so start a silent blip
function unlockAudio() {
  if (!audioCtx) return;
  if (audioCtx.state !== 'running') audioCtx.resume();
  const blip = audioCtx.createBufferSource();
  blip.buffer = audioCtx.createBuffer(1, 1, 22050);
  blip.connect(audioCtx.destination);
  blip.start(0);
}

let unlocked = false;
function unlockPhone() {
  if (unlocked) return;
  unlocked = true;
  unlockAudio();
  lockScreen.classList.add('unlocked');
  // on a slow connection wait (briefly) for the sounds, so the notification
  // and its sound still arrive together
  const timeout = new Promise(ok => setTimeout(ok, 1500));
  Promise.race([soundsReady, timeout]).then(showWelcome);
}

let dragStartX = 0;
let dragX = 0;
let dragging = false;
const maxDrag = () => sliderTrack.clientWidth - sliderKnob.offsetWidth - 6;

sliderKnob.addEventListener('pointerdown', (e) => {
  dragging = true;
  dragStartX = e.clientX - dragX;
  sliderKnob.classList.remove('snap');
  sliderKnob.setPointerCapture(e.pointerId);
});

sliderKnob.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  dragX = Math.max(0, Math.min(e.clientX - dragStartX, maxDrag()));
  sliderKnob.style.transform = 'translateX(' + dragX + 'px)';
});

function endDrag(e) {
  if (!dragging) return;
  dragging = false;
  // a very fast flick can skip the move events, so measure where it ended
  if (e && e.type === 'pointerup') {
    dragX = Math.max(dragX, Math.min(e.clientX - dragStartX, maxDrag()));
  }
  if (dragX >= maxDrag() * 0.9) {
    sliderKnob.style.transform = 'translateX(' + maxDrag() + 'px)';
    unlockPhone();
  } else {
    // not far enough: spring back like the real thing
    dragX = 0;
    sliderKnob.classList.add('snap');
    sliderKnob.style.transform = 'translateX(0)';
  }
}
sliderKnob.addEventListener('pointerup', endDrag);
sliderKnob.addEventListener('pointercancel', endDrag);
// Phones differ on which part of a gesture allows audio (iPhones want
// touchend, which can fire before or after pointerup), so switch it on at
// every stage of the slide; unlockAudio is harmless to repeat
['pointerdown', 'touchstart', 'touchend', 'pointerup'].forEach(type => {
  sliderKnob.addEventListener(type, unlockAudio, { passive: true });
});

// keyboard: Enter or Space unlocks
lockScreen.tabIndex = 0;
lockScreen.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    unlockPhone();
  }
});
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