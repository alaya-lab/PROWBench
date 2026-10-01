(() => {
  'use strict';
  // Preserve links shared before the three pages were separated.
  const oldSections = {
    '#results': 'gallery.html#results',
    '#benchmark': 'index.html',
    '#leaderboard': 'index.html',
    '#aggregate-method': 'index.html'
  };
  const destination = oldSections[window.location.hash];
  if (destination) { window.location.replace(destination); return; }
  const $ = (selector) => document.querySelector(selector);
  const data = window.PROWBENCH_STRUCTURAL_INPUTS;
  const Player = window.PROWBenchGalleryPlayer;
  const select = $('#structural-example');
  const playButton = $('#structural-play');
  const status = $('#structural-status');
  const timeline = $('#structural-time');
  if (!data?.examples?.length || !Player) {
    playButton.disabled = true;
    select.disabled = true;
    status.classList.remove('sr-only');
    status.textContent = 'The inputs could not be loaded. Please reload or open the video links above.';
    return;
  }
  const cards = ['white', 'mixed', 'obb'].map((kind) => {
    const video = $(`#repr-${kind}`);
    const error = video.parentElement.querySelector('.structural-error');
    video.muted = true;
    video.addEventListener('loadstart', () => { error.hidden = true; });
    video.addEventListener('error', () => { if (video.getAttribute('src')) error.hidden = false; });
    return {kind, video, error, link: $(`#open-${kind}`)};
  });
  const player = new Player({
    mediaSource: new Player.MediaSource(),
    onTime: (time, duration) => {
      timeline.max = String(duration);
      timeline.value = String(time);
      timeline.setAttribute('aria-valuetext', `${time.toFixed(1)} seconds of ${duration.toFixed(1)}`);
      const label = `${time.toFixed(1)} / ${duration.toFixed(1)} s`;
      if ($('#structural-time-label').textContent !== label) $('#structural-time-label').textContent = label;
    },
    onState: (state, message) => {
      const labels = {idle: '▶ Play', loading: 'Cancel', seeking: 'Cancel', buffering: 'Cancel', playing: 'Ⅱ Pause', paused: '▶ Play', ended: '↻ Replay', error: '↻ Retry'};
      const accessibleLabels = {idle: 'Play inputs', loading: 'Cancel loading', seeking: 'Cancel loading', buffering: 'Cancel loading', playing: 'Pause inputs', paused: 'Play inputs', ended: 'Replay inputs', error: 'Retry inputs'};
      const messages = {idle: 'Press Play to load this example.', loading: 'Loading the three structural inputs…', seeking: 'Loading the selected moment…', buffering: 'Waiting for all three inputs to resume together.', playing: 'Playing all three representations together.'};
      playButton.textContent = labels[state];
      playButton.setAttribute('aria-label', accessibleLabels[state]);
      playButton.title = accessibleLabels[state];
      status.textContent = messages[state] || (message || '').replaceAll('Play comparison', 'Play').replaceAll('comparison', 'example');
      status.classList.toggle('sr-only', !['loading', 'seeking', 'buffering', 'error'].includes(state));
    }
  });
  function showExample(id) {
    const example = data.examples.find((item) => item.id === id);
    if (!example) return;
    player.setMedia([]);
    const durations = [5];
    const names = {white: 'Coarse 3D', mixed: 'CWM proxy', obb: 'Colored-OBB'};
    const bindings = cards.map((card) => {
      const clip = example.inputs[card.kind];
      card.video.poster = clip.poster;
      card.video.setAttribute('aria-label', `${names[card.kind]} structural input: ${example.title}`);
      card.link.href = clip.src;
      card.link.setAttribute('aria-label', `Open ${names[card.kind]} input for ${example.title}`);
      card.error.hidden = true;
      durations.push(clip.duration);
      return {video: card.video, src: clip.src};
    });
    player.setMedia(bindings, Math.min(...durations));
  }
  select.addEventListener('change', () => showExample(select.value));
  playButton.addEventListener('click', () => {
    if (player.playing || player.busy) player.pause();
    else player.start();
  });
  $('#structural-reset').addEventListener('click', () => player.reset());
  timeline.addEventListener('input', () => {
    const value = Number(timeline.value);
    player.pause('Release the timeline to show this moment.');
    player.showTime(value);
  });
  timeline.addEventListener('change', () => player.seek(Number(timeline.value)));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) player.suspend('Playback paused while the inputs are off screen.');
    }, {threshold: .05}).observe($('#structural-grid'));
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) player.suspend('Playback paused while this tab is in the background.');
  });
  window.addEventListener('pagehide', () => player.suspend());
  showExample(select.value);
})();
