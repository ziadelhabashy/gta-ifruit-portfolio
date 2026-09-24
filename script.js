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
// Untrimmed original files (trimmed MP3s wouldn't decode on iPhone). Offsets
// are measured so playback starts right at the sound, skipping the hiss before
// it; the touch recording is noisy throughout, so only the tap itself is kept.
const SOUNDS = {
  notif: { url: 'assets/sounds/ifruit-tap.mp3?v=3', offset: 0.208 },
  touch: { url: 'assets/sounds/touch.mp3?v=3', offset: 0.605, duration: 0.06 },
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
    src.connect(gain);
    gain.connect(audioCtx.destination);
    const { offset, duration } = SOUNDS[name];
    const length = duration || (src.buffer.duration - offset);
    // tiny fade in/out so cutting into the recording doesn't click
    const now = audioCtx.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(SOUND_VOLUME, now + 0.004);
    gain.gain.setValueAtTime(SOUND_VOLUME, now + Math.max(0.005, length - 0.02));
    gain.gain.linearRampToValueAtTime(0, now + length);
    if (duration) src.start(now, offset, duration);
    else src.start(now, offset);
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

// Lock screen: tap the "tap to iFruit" bar to unlock
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
  // Safety net: if the phone still didn't allow sound, the silent loop tells
  // us, and the welcome notification waits for the visitor's next tap so the
  // notification and its sound still arrive together.
  const shortWait = new Promise(ok => setTimeout(() => ok(true), 400));
  Promise.race([silentLoopStarted, shortWait]).then(allowed => {
    if (allowed) {
      // on a slow connection wait (briefly) for the sounds to finish loading
      const timeout = new Promise(ok => setTimeout(ok, 1500));
      Promise.race([soundsReady, timeout]).then(showWelcome);
    } else {
      dbg('sound not allowed yet: welcome waits for next tap');
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

// Tap the "tap to iFruit" bar to unlock. A tap (unlike a slide) counts as
// permission to play sound on iPhones too, so the welcome notification and its
// sound arrive together everywhere. The arrow glides across as a small flourish.
function tapUnlock(e) {
  if (unlocked || sliderTrack.classList.contains('going')) return;
  unlockAudio(e); // inside the tap itself, so phones allow the sound
  sliderTrack.classList.add('going');
  const travel = sliderTrack.clientWidth - sliderKnob.offsetWidth - 6;
  sliderKnob.style.transform = 'translateX(' + travel + 'px)';
  setTimeout(unlockPhone, 280);
}
sliderTrack.addEventListener('click', tapUnlock);

// keyboard: Enter or Space anywhere on the lock screen unlocks too
lockScreen.addEventListener('keydown', (e) => {
  if (e.target === sliderTrack) return; // the button handles its own keys
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    tapUnlock(e);
  }
});
sliderTrack.focus();

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