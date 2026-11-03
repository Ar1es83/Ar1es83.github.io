// 纯静态梦核小站：时钟 + 可操作的音乐播放器。
// 想换成自己的歌曲，可给下面的曲目加上 src: './music/your-song.mp3'。
document.addEventListener('DOMContentLoaded', () => {
  const clock = document.getElementById('liveClock');
  function updateClock() {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    clock.textContent = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  }
  updateClock();
  setInterval(updateClock, 1000);

  // 没有提供音频素材时，三首曲目由浏览器实时合成，确实可以播放、暂停、切歌和跳进度。
  const playlist = [
    { title: '01. 无尽的下午', duration: 156, notes: [261.63, 329.63, 392, 493.88] },
    { title: '02. 空荡荡的商场', duration: 184, notes: [220, 261.63, 329.63, 392] },
    { title: '03. 蓝色走廊', duration: 142, notes: [174.61, 220, 261.63, 329.63] }
  ];
  const audio = document.getElementById('audioEngine');
  const playButton = document.getElementById('btnPlay');
  const playIcon = document.getElementById('playIcon');
  const prevButton = document.getElementById('btnPrev');
  const nextButton = document.getElementById('btnNext');
  const listButton = document.getElementById('btnPlaylistToggle');
  const drawer = document.getElementById('playlistDrawer');
  const list = document.getElementById('playlistUl');
  const trackTitle = document.getElementById('currentTrackTitle');
  const timeDisplay = document.getElementById('timeDisplay');
  const seek = document.getElementById('seekSlider');
  const fill = document.getElementById('seekbarFill');
  const thumb = document.getElementById('seekbarThumb');

  let currentIndex = 0;
  let playing = false;
  let position = 0;
  let startedAt = 0;
  let audioContext;
  let voices = [];
  let synthInterval;
  let animationFrame;
  const duration = () => playlist[currentIndex].src ? (Number.isFinite(audio.duration) ? audio.duration : playlist[currentIndex].duration) : playlist[currentIndex].duration;
  const stamp = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

  function display() {
    const total = duration() || 0;
    const at = Math.max(0, Math.min(position, total));
    timeDisplay.textContent = `${stamp(at)} / ${stamp(total)}`;
    seek.max = String(total);
    seek.value = String(at);
    const percent = total ? `${(at / total) * 100}%` : '0%';
    fill.style.width = percent;
    thumb.style.left = percent;
  }

  function stopVoices() {
    clearInterval(synthInterval);
    synthInterval = undefined;
    voices.forEach((voice) => { try { voice.stop(); } catch (_) { /* already ended */ } });
    voices = [];
  }

  // 每个小节柔和地叠加四个音；素材可用后优先播放真实音频文件。
  function playChord() {
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    if (!audioContext) audioContext = new Context();
    if (audioContext.state === 'suspended') audioContext.resume();
    const now = audioContext.currentTime;
    playlist[currentIndex].notes.forEach((frequency, i) => {
      const voice = audioContext.createOscillator();
      const volume = audioContext.createGain();
      voice.type = i % 2 ? 'triangle' : 'sine';
      voice.frequency.value = frequency / (i === 0 ? 2 : 1);
      volume.gain.setValueAtTime(0.0001, now);
      volume.gain.exponentialRampToValueAtTime(0.025, now + 0.3);
      volume.gain.exponentialRampToValueAtTime(0.0001, now + 3.8);
      voice.connect(volume).connect(audioContext.destination);
      voice.start(now);
      voice.stop(now + 4);
      voices.push(voice);
      voice.onended = () => { voices = voices.filter((item) => item !== voice); };
    });
  }

  function tick() {
    if (!playing) return;
    if (playlist[currentIndex].src) position = audio.currentTime;
    else position = (performance.now() - startedAt) / 1000;
    display();
    if (!playlist[currentIndex].src && position >= duration()) { changeTrack(1); return; }
    animationFrame = requestAnimationFrame(tick);
  }

  function pause() {
    if (!playing) return;
    playing = false;
    cancelAnimationFrame(animationFrame);
    audio.pause();
    stopVoices();
    playIcon.textContent = '▶';
    playButton.setAttribute('aria-label', '播放');
  }

  async function play() {
    if (playing) return;
    const track = playlist[currentIndex];
    try {
      if (track.src) {
        if (audio.getAttribute('src') !== track.src) audio.setAttribute('src', track.src);
        audio.currentTime = position;
        await audio.play();
      } else {
        const Context = window.AudioContext || window.webkitAudioContext;
        if (!Context) throw new Error('当前浏览器不支持音频合成');
        startedAt = performance.now() - position * 1000;
        playChord();
        synthInterval = setInterval(playChord, 4000);
      }
      playing = true;
      playIcon.textContent = 'Ⅱ';
      playButton.setAttribute('aria-label', '暂停');
      tick();
    } catch (error) {
      pause();
      trackTitle.textContent = '音频无法播放，请检查文件';
      console.error('播放失败：', error);
    }
  }

  function renderPlaylist() {
    list.replaceChildren();
    playlist.forEach((track, index) => {
      const item = document.createElement('li');
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `track-button${index === currentIndex ? ' active' : ''}`;
      button.textContent = `${index === currentIndex ? '▶ ' : '  '} ${track.title}`;
      button.addEventListener('click', () => { if (index !== currentIndex) selectTrack(index); });
      item.appendChild(button);
      list.appendChild(item);
    });
  }

  function selectTrack(index) {
    const resume = playing;
    pause();
    currentIndex = (index + playlist.length) % playlist.length;
    position = 0;
    audio.removeAttribute('src');
    audio.load();
    trackTitle.textContent = playlist[currentIndex].title;
    display();
    renderPlaylist();
    if (resume) play();
  }
  function changeTrack(delta) { selectTrack(currentIndex + delta); }

  playButton.addEventListener('click', () => playing ? pause() : play());
  prevButton.addEventListener('click', () => changeTrack(-1));
  nextButton.addEventListener('click', () => changeTrack(1));
  listButton.addEventListener('click', () => {
    const expanded = listButton.getAttribute('aria-expanded') === 'true';
    listButton.setAttribute('aria-expanded', String(!expanded));
    drawer.classList.toggle('is-open', !expanded);
  });
  seek.addEventListener('input', () => {
    position = Number(seek.value);
    if (playlist[currentIndex].src) audio.currentTime = position;
    else if (playing) startedAt = performance.now() - position * 1000;
    display();
  });
  audio.addEventListener('loadedmetadata', display);
  audio.addEventListener('ended', () => changeTrack(1));
  audio.addEventListener('error', () => { if (playing) { pause(); trackTitle.textContent = '音频文件未找到'; } });
  trackTitle.textContent = playlist[0].title;
  display();
  renderPlaylist();
});
