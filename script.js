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
const tapSound = new Audio('assets/sounds/ifruit-tap.mp3');
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
  tapSound.currentTime = 0;
  return tapSound.play();
}

function toggleSound() {
  soundMuted = !soundMuted;
  try { localStorage.setItem('ifruit-muted', soundMuted ? '1' : '0'); } catch (e) {}
  renderSoundToggle();
}

renderSoundToggle();

// Welcome text notification on page open. Browsers block sound until the
// visitor interacts, so if autoplay is refused the sound plays on the first
// tap/click while the notification is still showing.
const welcome = document.getElementById('welcome-notif');
let welcomeTimer;

function hideWelcome() {
  welcome.classList.remove('show');
  clearTimeout(welcomeTimer);
}

function showWelcome() {
  welcome.classList.add('show');
  welcomeTimer = setTimeout(hideWelcome, 6000);
  playTap().catch(() => {
    const retry = () => {
      if (welcome.classList.contains('show')) playTap().catch(() => {});
    };
    document.addEventListener('pointerdown', retry, { once: true });
    document.addEventListener('keydown', retry, { once: true });
  });
}

welcome.addEventListener('click', hideWelcome);
setTimeout(showWelcome, 600);

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