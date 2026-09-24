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

// iFruit notification sound (muted state remembered per visitor)
const tapSound = new Audio('assets/sounds/ifruit-tap.mp3?v=2');
tapSound.preload = 'auto';
tapSound.volume = 0.6;

let soundMuted = false;
try { soundMuted = localStorage.getItem('ifruit-muted') === '1'; } catch (e) {}

function renderSoundToggle() {
  const btn = document.getElementById('sound-toggle');
  btn.classList.toggle('muted', soundMuted);
  const label = soundMuted ? 'Unmute sounds' : 'Mute sounds';
  btn.title = label;
  btn.setAttribute('aria-label', label);
}

function playTap() {
  if (soundMuted) return Promise.resolve();
  tapSound.currentTime = 0.06;
  return tapSound.play();
}

function toggleSound() {
  soundMuted = !soundMuted;
  try { localStorage.setItem('ifruit-muted', soundMuted ? '1' : '0'); } catch (e) {}
  renderSoundToggle();
}

renderSoundToggle();

// Touch sound for the 9 app tiles and the home/back buttons (on screen and
// on the phone bezel). Starts slightly in to skip the MP3's built-in padding.
const touchSound = new Audio('assets/sounds/touch.mp3?v=2');
touchSound.preload = 'auto';
touchSound.volume = 0.6;

function playTouch() {
  if (soundMuted) return;
  touchSound.currentTime = 0.07;
  touchSound.play().catch(() => {});
}

document.querySelectorAll('.tile[data-title], .screen-btn, .hw-btn[onclick]').forEach(el => {
  el.addEventListener('pointerdown', playTouch);
});

// Welcome text notification, shown together with its sound when the visitor
// unlocks the phone. Browsers only allow sound after a tap, so the unlock tap
// is what makes the sound play at the same moment as the notification.
const welcome = document.getElementById('welcome-notif');
let welcomeTimer;

function hideWelcome() {
  welcome.classList.remove('show');
  clearTimeout(welcomeTimer);
}

function showWelcome() {
  welcome.classList.add('show');
  welcomeTimer = setTimeout(hideWelcome, 9000);
  playTap().catch(() => {});
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
  lockScreen.classList.add('unlocked');
  showWelcome();
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