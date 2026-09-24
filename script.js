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

// Notifications on unlock: the welcome text first, then missed calls slide in
// one after another underneath. Tap any of them to dismiss it.
const welcome = document.getElementById('welcome-notif');
const callNotifs = [...document.querySelectorAll('.notif-call:not(#call-google)')];
const googleCall = document.getElementById('call-google');
const notifTimers = [];

function showNotif(el) {
  el.classList.remove('leaving');
  el.classList.add('show');
}

function hideNotif(el) {
  if (!el.classList.contains('show') || el.classList.contains('leaving')) return;
  el.classList.add('leaving');
  setTimeout(() => el.classList.remove('show', 'leaving'), 300);
}

// Two layouts for the missed calls, picked by the link:
//   default        -> calls pop up after unlocking, under the welcome text
//   ?calls=lock    -> calls are already listed on the lock screen
const callsOnLock = new URLSearchParams(location.search).get('calls') === 'lock';

if (callsOnLock) {
  const list = document.getElementById('lock-notifs');
  callNotifs.forEach((el, i) => {
    const row = document.createElement('div');
    row.className = 'lock-notif';
    row.style.animationDelay = (0.4 + i * 0.35) + 's';
    row.innerHTML =
      el.querySelector('.call-avatar').outerHTML +
      '<div class="lock-notif-text"><b>' + el.querySelector('.notif-name').textContent +
      '</b><span>Missed Call</span></div><span class="lock-notif-time">now</span>';
    list.appendChild(row);
  });
  list.hidden = false;
}

function showWelcome() {
  showNotif(welcome);
  playSound('notif');
  if (callsOnLock) {
    // the other calls are on the lock screen; inside, only Google calls
    notifTimers.push(setTimeout(() => {
      showNotif(googleCall);
      playSound('notif');
    }, 1200));
    notifTimers.push(setTimeout(() => hideNotif(welcome), 9000));
    notifTimers.push(setTimeout(() => hideNotif(googleCall), 9150));
    return;
  }
  callNotifs.forEach((el, i) => {
    notifTimers.push(setTimeout(() => {
      showNotif(el);
      playSound('notif');
    }, 1200 + i * 900));
  });
  // clear them all a while after the last call arrives, oldest first
  const clearAt = 1200 + callNotifs.length * 900 + 6000;
  [welcome, ...callNotifs].forEach((el, i) => {
    notifTimers.push(setTimeout(() => hideNotif(el), clearAt + i * 150));
  });
}

[welcome, googleCall, ...callNotifs].forEach(el => el.addEventListener('click', () => hideNotif(el)));

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
// iPhones count touchend (not pointerup) as the gesture that allows audio
sliderKnob.addEventListener('touchend', () => { if (unlocked) unlockAudio(); });

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