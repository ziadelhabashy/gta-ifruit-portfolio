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

// ---------- Debug panel (open the site with ?debug=1) ----------
// Shows what the browser's audio is doing, to diagnose sound issues on phones.
const DEBUG = new URLSearchParams(location.search).has('debug');
let debugPanel = null;
function dbg(msg) {
  if (!DEBUG) return;
  if (!debugPanel) {
    debugPanel = document.createElement('pre');
    debugPanel.style.cssText = 'position:fixed;left:0;right:0;top:0;max-height:32vh;overflow:hidden;margin:0;pointer-events:none;' +
      'padding:6px 8px;background:rgba(0,0,0,.88);color:#7CFC9A;font:11px/1.35 monospace;z-index:99999;white-space:pre-wrap;';
    document.body.appendChild(debugPanel);
  }
  const t = (performance.now() / 1000).toFixed(2);
  debugPanel.textContent += t + 's  ' + msg + '\n';
  debugPanel.scrollTop = debugPanel.scrollHeight;
}
if (DEBUG) {
  window.addEventListener('error', e => dbg('ERROR ' + e.message));
  window.addEventListener('unhandledrejection', e => dbg('REJECTED ' + (e.reason && e.reason.message || e.reason)));
  dbg(navigator.userAgent);
}

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
dbg('Web Audio: ' + (audioCtx ? 'yes, state=' + audioCtx.state : 'NOT SUPPORTED') +
    ' | audioSession: ' + (navigator.audioSession ? navigator.audioSession.type : 'not supported'));
if (audioCtx) audioCtx.onstatechange = () => dbg('audio state -> ' + audioCtx.state);

function loadSound(name) {
  return fetch(SOUNDS[name].url)
    .then(res => res.arrayBuffer())
    // callback form of decodeAudioData so older Safari works too
    .then(data => new Promise((ok, fail) => audioCtx.decodeAudioData(data, ok, fail)))
    .then(buffer => {
      soundBuffers[name] = buffer;
      dbg('loaded ' + name + ' (' + buffer.duration.toFixed(2) + 's)');
    })
    .catch(err => dbg('LOAD FAILED ' + name + ': ' + (err && err.message || err)));
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
  tag.play()
    .then(() => dbg('played ' + name + ' via <audio> backup'))
    .catch(err => dbg('<audio> backup BLOCKED ' + name + ': ' + (err && err.message || err)));
}

function playSound(name) {
  dbg('play ' + name + ' | muted=' + soundMuted + ' | audio state=' + (audioCtx ? audioCtx.state : 'none') +
      ' | loaded=' + !!soundBuffers[name]);
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
  else audioCtx.resume().then(start).catch(err => dbg('resume BLOCKED: ' + (err && err.message || err)));
}

// Touch sound for the 9 app tiles and the home/back buttons (on screen and
// on the phone bezel)
document.querySelectorAll('.tile[data-title], .screen-btn, .hw-btn[onclick]').forEach(el => {
  el.addEventListener('pointerdown', () => playSound('touch'));
});

// Inside, after unlocking: the welcome notification. Tap it to dismiss it.
const welcome = document.getElementById('welcome-notif');

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
  setTimeout(() => hideNotif(welcome), 9000);
}

welcome.addEventListener('click', () => hideNotif(welcome));

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

// iPhones mute Web Audio when the ring/silent switch is on silent, but not
// <audio> tags. Looping a silent <audio> tag (started inside a gesture) makes
// iOS treat the page as media playback, so the Web Audio sounds come through.
let silentLoop = null;
let silentLoopStarted = Promise.resolve(true); // resolves true if allowed, false if blocked
function keepIOSAudioAudible() {
  if (silentLoop) {
    if (silentLoop.paused) silentLoopStarted = silentLoop.play().then(() => true, () => false);
    return;
  }
  // half a second of silence as a tiny 8 kHz mono WAV
  const rate = 8000, samples = rate / 2, bytes = new ArrayBuffer(44 + samples * 2);
  const v = new DataView(bytes);
  const text = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  text(0, 'RIFF'); v.setUint32(4, 36 + samples * 2, true); text(8, 'WAVE');
  text(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  text(36, 'data'); v.setUint32(40, samples * 2, true);
  silentLoop = new Audio(URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' })));
  silentLoop.loop = true;
  silentLoop.setAttribute('playsinline', '');
  silentLoopStarted = silentLoop.play()
    .then(() => { dbg('silent loop playing (iPhone silent-switch fix)'); return true; })
    .catch(err => { dbg('silent loop BLOCKED: ' + (err && err.message || err)); return false; });
}

// if it couldn't start during the unlock, any later tap starts it
document.addEventListener('touchend', () => { if (unlocked) keepIOSAudioAudible(); }, { passive: true });

// has to run inside the gesture itself, or phones keep audio blocked; older
// iPhones also need something to actually play, so start a silent blip
function unlockAudio(e) {
  dbg('gesture ' + (e && e.type || 'unlock') + ' | audio state=' + (audioCtx ? audioCtx.state : 'none'));
  keepIOSAudioAudible();
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
  // iPhones don't count a slide (drag) as permission to play sound, only a
  // tap. The silent loop tells us which it was: allowed -> show the welcome
  // notification now; blocked -> hold it until the visitor's first tap, so
  // the notification and its sound still arrive together.
  const shortWait = new Promise(ok => setTimeout(() => ok(true), 400));
  Promise.race([silentLoopStarted, shortWait]).then(allowed => {
    if (allowed) {
      // on a slow connection wait (briefly) for the sounds to finish loading
      const timeout = new Promise(ok => setTimeout(ok, 1500));
      Promise.race([soundsReady, timeout]).then(showWelcome);
    } else {
      dbg('slide did not allow sound (iPhone): welcome waits for first tap');
      holdWelcomeUntilTap();
    }
  });
}

function holdWelcomeUntilTap() {
  const onFirstTap = (e) => {
    document.removeEventListener('touchend', onFirstTap, true);
    document.removeEventListener('click', onFirstTap, true);
    unlockAudio(e);
    showWelcome();
  };
  // capture phase, so this runs before whatever was tapped
  document.addEventListener('touchend', onFirstTap, true);
  document.addEventListener('click', onFirstTap, true);
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