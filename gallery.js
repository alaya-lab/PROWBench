(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const data = window.PROWBENCH_GALLERY;
  const Player = window.PROWBenchGalleryPlayer;
  const SceneStore = window.PROWBenchGallerySceneStore;
  const playButton = $('#play-all');
  const status = $('#playback-status');
  const setStatus = (message, visible = false) => {
    status.textContent = message;
    status.classList.toggle('sr-only', !visible);
  };
  if (!data?.protocols?.length || !data?.models?.length || !Player || !SceneStore) {
    setStatus('The gallery could not be loaded. Please reload the page.', true);
    playButton.disabled = true;
    return;
  }
  const board = $('#compare-board');
  const addMethod = $('#add-method');
  const sceneSelect = $('#scene-select');
  const referenceSelect = $('#reference-select');
  const qualitySelect = $('#video-quality');
  const timeline = $('#comparison-time');
  const inputVideo = $('#input-video');
  const inputImage = $('#input-image');
  const inputError = $('#input-error');
  const cards = [];
  const promptCache = new Map();
  const sceneStore = new SceneStore();
  const firstScene = data.protocols[0].scenes[0];
  if (data.initialScene) sceneStore.seed(firstScene.data, data.initialScene);
  let currentScene = null;
  let protocolIndex = 0;
  let sceneIndex = 0;
  let reference = 'obb';
  let quality = '480';
  try {
    const saved = localStorage.getItem('prowbench-video-quality');
    if (['480', '720'].includes(saved)) quality = saved;
  } catch (_) { /* Playback also works when preference storage is unavailable. */ }
  qualitySelect.value = quality;
  let nextCardId = 0;
  const protocol = () => data.protocols[protocolIndex];
  const scene = () => protocol().scenes[sceneIndex];
  const models = Object.fromEntries(data.models.map((model) => [model.id, model]));
  const protocolModels = () => (protocol().modelIds || data.models.map((model) => model.id)).map((id) => models[id]);
  const currentView = () => currentScene?.grid || currentScene?.views?.[0] || currentScene;
  const savedMethods = new Map();
  const savedProtocols = new Map();
  const displayTime = (time, duration) => {
    timeline.max = String(duration);
    timeline.value = String(time);
    timeline.setAttribute('aria-valuetext', `${time.toFixed(1)} seconds of ${duration.toFixed(1)}`);
    const label = `${time.toFixed(1)} / ${duration.toFixed(1)} s`;
    if ($('#time-label').textContent !== label) $('#time-label').textContent = label;
  };
  const player = new Player({
    mediaSource: new Player.MediaSource({maxBytes: 16 * 1024 * 1024}),
    onTime: displayTime,
    onState: (state, message) => {
      const labels = {idle: '▶ Play', loading: 'Cancel', seeking: 'Cancel', buffering: 'Cancel', playing: 'Ⅱ Pause', paused: '▶ Play', ended: '↻ Replay', error: '↻ Retry'};
      const accessibleLabels = {idle: 'Play comparison', loading: 'Cancel loading', seeking: 'Cancel loading', buffering: 'Cancel loading', playing: 'Pause comparison', paused: 'Play comparison', ended: 'Replay comparison', error: 'Retry comparison'};
      const messages = {loading: 'Loading the selected videos…', seeking: 'Loading the selected moment…', buffering: 'Buffering together; playback will resume when all selected videos are ready.', playing: 'Playing the selected videos together.'};
      playButton.textContent = labels[state];
      playButton.setAttribute('aria-label', accessibleLabels[state]);
      setStatus(message || messages[state] || '', ['loading', 'seeking', 'buffering', 'error'].includes(state));
    }
  });
  $('#selection-summary').textContent = `${data.sceneCount} examples · ${data.outputCount.toLocaleString('en-US')} outputs · ${data.models.length} methods`;
  $('#time-label').setAttribute('aria-live', 'off');

  async function loadPrompt(card) {
    if (!card.details.open || !card.promptUrl) return;
    card.promptController?.abort();
    const controller = new AbortController();
    card.promptController = controller;
    const url = card.promptUrl;
    card.promptStatus.hidden = false;
    card.promptStatus.textContent = 'Loading the generation prompt…';
    card.promptText.hidden = true;
    try {
      let text = promptCache.get(url);
      if (text === undefined) {
        const response = await fetch(url, {signal: controller.signal});
        if (!response.ok) throw new Error('prompt');
        text = await response.text();
      }
      if (controller.signal.aborted || card.promptUrl !== url) return;
      promptCache.delete(url);
      promptCache.set(url, text);
      while (promptCache.size > 20) promptCache.delete(promptCache.keys().next().value);
      card.promptText.textContent = text;
      card.promptText.hidden = false;
      card.promptStatus.hidden = true;
    } catch (error) {
      if (error.name !== 'AbortError' && card.promptUrl === url) card.promptStatus.textContent = 'The prompt could not be loaded. Use the download link below, or close and reopen this panel to retry.';
    }
  }

  function updateMethodControls() {
    const available = protocolModels();
    const selected = new Set(cards.map((card) => card.modelId));
    cards.forEach((card, index) => {
      const label = `Method ${String.fromCharCode(65 + index)}`;
      card.heading.textContent = label;
      card.label.textContent = `Comparison method ${String.fromCharCode(65 + index)}`;
      card.select.value = card.modelId;
      [...card.select.options].forEach((option) => {
        option.disabled = option.value !== card.modelId && selected.has(option.value);
        option.textContent = models[option.value].name + (currentView() && !currentView().outputs[option.value] ? ' · unavailable' : '');
      });
      card.remove.disabled = cards.length <= 1;
      card.remove.setAttribute('aria-label', `Remove ${models[card.modelId].name} comparison`);
      card.remove.title = cards.length <= 1 ? 'Keep at least one method' : `Remove ${models[card.modelId].name}`;
    });
    $('#method-count').textContent = `${cards.length} / ${available.length} methods`;
    addMethod.disabled = !currentScene || cards.length >= available.length;
    addMethod.title = cards.length >= available.length ? 'All methods are already selected' : 'Add another method to compare';
  }

  function createMethodCard(modelId) {
    const available = protocolModels();
    if (!available.some((model) => model.id === modelId) || cards.length >= available.length || cards.some((card) => card.modelId === modelId)) return null;
    const id = ++nextCardId;
    const article = document.createElement('article');
    article.className = 'compare-card output-card';
    article.innerHTML = `<div class="compare-card-header"><h2></h2><label class="sr-only" for="method-${id}"></label><select id="method-${id}" aria-describedby="condition-${id}"></select><button class="remove-method" type="button"><span aria-hidden="true">×</span></button></div><div class="media-frame"><video muted playsinline preload="none"></video><p class="media-error" hidden>Video unavailable. Try another method or open its link.</p></div><p id="condition-${id}" class="conditioning"></p><div class="variant-control" hidden><label for="version-${id}">Version</label><select id="version-${id}"></select></div><div class="output-footer"><details class="prompt-details"><summary>Prompt</summary><div class="prompt-body"><p class="prompt-status" role="status"></p><pre hidden tabindex="0" aria-label="Generation prompt text"></pre><a class="prompt-link" target="_blank" rel="noopener" download>Download prompt ↗</a></div></details><a class="video-link" target="_blank" rel="noopener">Open video ↗</a></div>`;
    board.append(article);
    const card = {article, modelId, heading: article.querySelector('h2'), label: article.querySelector('label'), remove: article.querySelector('.remove-method'), select: article.querySelector('select'), condition: article.querySelector('.conditioning'), video: article.querySelector('video'), error: article.querySelector('.media-error'), link: article.querySelector('.video-link'), details: article.querySelector('details'), promptStatus: article.querySelector('.prompt-status'), promptText: article.querySelector('pre'), promptLink: article.querySelector('.prompt-link'), promptUrl: '', promptController: null};
    card.variantControl = article.querySelector('.variant-control');
    card.variantSelect = card.variantControl.querySelector('select');
    card.variantId = '';
    card.variantSelect.addEventListener('change', () => {
      card.variantId = card.variantSelect.value;
      renderComparison();
    });
    const groups = new Map();
    available.forEach((model) => {
      if (!groups.has(model.group)) {
        const group = document.createElement('optgroup');
        group.label = model.group;
        groups.set(model.group, group);
        card.select.append(group);
      }
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      groups.get(model.group).append(option);
    });
    card.select.addEventListener('change', () => {
      if (!models[card.select.value] || cards.some((other) => other !== card && other.modelId === card.select.value)) {
        card.select.value = card.modelId;
        return;
      }
      card.modelId = card.select.value;
      card.variantId = '';
      renderComparison();
    });
    card.remove.addEventListener('click', () => {
      if (cards.length <= 1) return;
      const index = cards.indexOf(card);
      cards.splice(index, 1);
      card.promptController?.abort();
      card.promptUrl = '';
      // Detach from the player before removing the DOM node, releasing its decoder and requests.
      renderComparison();
      disposeCard(card);
      updateMethodControls();
      (cards[Math.min(index, cards.length - 1)]?.select || addMethod).focus();
    });
    card.video.muted = true;
    card.video.addEventListener('loadstart', () => { card.error.hidden = true; });
    card.video.addEventListener('error', () => { if (card.video.getAttribute('src')) card.error.hidden = false; });
    card.details.addEventListener('toggle', () => {
      if (card.details.open) loadPrompt(card);
      else card.promptController?.abort();
    });
    cards.push(card);
    return card;
  }
  function disposeCard(card) {
    card.promptController?.abort();
    card.promptUrl = '';
    card.video.pause();
    card.video.removeAttribute('src');
    card.video.removeAttribute('poster');
    card.video.load();
    card.article.remove();
  }
  addMethod.addEventListener('click', () => {
    if (!currentScene) return;
    const unselected = protocolModels().filter((model) => !cards.some((card) => card.modelId === model.id));
    const model = unselected.find((item) => currentView().outputs[item.id]) || unselected[0];
    if (!model) return;
    const card = createMethodCard(model.id);
    renderComparison();
    card?.select.focus();
  });

  function renderComparison({position = 0} = {}) {
    updateMethodControls();
    if (!currentScene) return;
    const current = currentView();
    const multiview = Boolean(currentScene.grid);
    board.classList.toggle('is-multiview', multiview);
    board.querySelectorAll('.media-frame').forEach((frame) => {
      let labels = frame.querySelector('.view-labels');
      if (multiview && !labels) {
        labels = document.createElement('div');
        labels.className = 'view-labels';
        labels.setAttribute('aria-hidden', 'true');
        currentScene.views.forEach((view) => {
          const label = document.createElement('span');
          label.textContent = view.label;
          labels.append(label);
        });
        frame.append(labels);
      }
      if (labels) labels.hidden = !multiview;
    });
    const isProvided = protocol().id === 'with-first-frame';
    referenceSelect.replaceChildren();
    const choices = [['obb', 'Colored-OBB'], ['white', 'Coarse 3D'], ['mixed', 'CWM proxy']];
    if (protocol().dataset !== 'long-video') choices.push(['frame', isProvided ? 'Verified first frame' : 'Unchecked H3 first frame']);
    if (!choices.some(([value]) => value === reference)) reference = 'obb';
    choices.forEach(([value, label]) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      referenceSelect.append(option);
    });
    referenceSelect.value = reference;
    const descriptions = {obb: 'Positions, orientations, and motion.', white: 'Untextured geometry and pose.', mixed: 'Geometry and semantic colors.', frame: isProvided ? 'Shared appearance reference checked against the recorded state.' : 'Unchecked frame 0 of the MiniMax-H3 output.'};
    $('#input-description').textContent = descriptions[reference];
    inputError.hidden = true;
    inputVideo.hidden = reference === 'frame';
    inputImage.hidden = reference !== 'frame';
    let input = null;
    if (reference === 'frame') {
      const src = isProvided ? current.firstFrame : current.outputs.h3.poster;
      inputImage.src = src;
      inputImage.alt = `${isProvided ? 'Verified first-frame reference' : 'Unchecked MiniMax-H3 first frame'}: ${currentScene.title}, ${current.label || scene().camera}`;
      $('#input-open').href = src;
      $('#input-open').textContent = 'Open image ↗';
      $('#input-kind').textContent = isProvided ? 'Verified appearance reference' : 'Unchecked generated reference';
    } else {
      inputImage.removeAttribute('src');
      input = Player.selectRendition(current.inputs[reference], quality);
      inputVideo.poster = input.poster;
      inputVideo.setAttribute('aria-label', `${referenceSelect.selectedOptions[0].textContent} input: ${currentScene.title}, ${current.label || scene().camera}`);
      $('#input-open').href = input.src;
      $('#input-open').textContent = 'Open input ↗';
      $('#input-kind').textContent = 'Structural input';
    }
    const bindings = [];
    const durations = [current.duration || Infinity];
    cards.forEach((card) => {
      const model = models[card.modelId];
      const primary = current.outputs[model.id];
      const variants = primary?.variants || [];
      if (!variants.some((variant) => variant.id === card.variantId)) card.variantId = '';
      card.variantControl.hidden = !variants.length;
      card.variantSelect.setAttribute('aria-label', `${model.name} output version`);
      card.variantSelect.replaceChildren();
      if (variants.length) {
        for (const variant of [{id: '', label: primary.variantLabel || 'Original'}, ...variants]) {
          const option = document.createElement('option');
          option.value = variant.id;
          option.textContent = variant.label;
          card.variantSelect.append(option);
        }
        card.variantSelect.value = card.variantId;
      }
      const sample = Player.selectRendition(variants.find((variant) => variant.id === card.variantId) || primary, quality);
      const nativeNote = sample?.height && sample.height < Number(quality) ? ` · Original ${sample.height}p` : '';
      card.condition.textContent = (sample?.condition || 'Result not available') + nativeNote;
      if (sample) {
        if (card.video.getAttribute('poster') !== sample.poster) card.video.poster = sample.poster;
      } else card.video.removeAttribute('poster');
      card.video.hidden = !sample;
      card.video.setAttribute('aria-label', `${model.name}${card.variantId ? ` (${sample.label})` : ''}: ${currentScene.title}, ${current.label || scene().camera}`);
      card.error.hidden = Boolean(sample);
      card.error.textContent = sample ? 'Video unavailable. Try another method or open its link.' : current.unavailable?.[model.id] || 'No result provided for this scene.';
      card.link.hidden = !sample;
      if (sample) card.link.href = sample.src;
      else card.link.removeAttribute('href');
      card.link.setAttribute('aria-label', `Open ${model.name} output for ${currentScene.title}, ${current.label || scene().camera}`);
      card.details.hidden = !sample?.prompt;
      if (card.promptUrl !== (sample?.prompt || '')) {
        card.promptController?.abort();
        card.details.open = false;
        card.promptText.textContent = '';
        card.promptText.hidden = true;
        card.promptStatus.textContent = '';
      }
      card.promptUrl = sample?.prompt || '';
      if (sample?.prompt) card.promptLink.href = sample.prompt;
      else card.promptLink.removeAttribute('href');
      card.promptLink.setAttribute('aria-label', `Download the ${model.name} generation prompt`);
      if (sample) {
        bindings.push({video: card.video, src: sample.src});
        durations.push(sample.duration);
      }
    });
    if (input) { bindings.push({video: inputVideo, src: input.src}); durations.push(input.duration); }
    // Keep buffered, unchanged clips when only one method or input changes.
    const duration = Math.min(...durations);
    player.setMedia(bindings, Number.isFinite(duration) ? duration : 5, {retainUnchanged: true, position});
    playButton.disabled = timeline.disabled = $('#restart-all').disabled = bindings.length === 0;
    if (!bindings.length) setStatus('Choose an available method to play this scene.', true);
    $('#protocol-note').textContent = [protocol().note, currentScene.note].filter(Boolean).join(' ');
    const available = Object.keys(current.outputs).length;
    const viewSummary = multiview ? ' · 4 views · synchronized' : '';
    $('#scene-meta').textContent = `${currentScene.domain}${viewSummary} · ${Number.isFinite(duration) ? duration : 5} s` + (available < protocolModels().length ? ` · ${available} results available` : '');
  }
  function setSceneLoading(loading) {
    board.setAttribute('aria-busy', String(loading));
    playButton.disabled = loading;
    $('#restart-all').disabled = loading;
    timeline.disabled = loading;
    referenceSelect.disabled = loading;
    qualitySelect.disabled = loading;
    cards.forEach((card) => { card.select.disabled = card.variantSelect.disabled = loading; });
    updateMethodControls();
  }
  async function showScene(index) {
    sceneIndex = (index + protocol().scenes.length) % protocol().scenes.length;
    const selected = scene();
    currentScene = null;
    player.setMedia([]);
    setSceneLoading(true);
    $('#retry-scene').hidden = true;
    sceneSelect.value = selected.id;
    $('#scene-count').textContent = `${sceneIndex + 1} / ${protocol().scenes.length}`;
    $('#scene-meta').textContent = selected.domain;
    inputVideo.removeAttribute('poster');
    inputImage.removeAttribute('src');
    inputImage.hidden = true;
    inputError.hidden = true;
    $('#input-open').removeAttribute('href');
    cards.forEach((card) => {
      card.video.removeAttribute('poster');
      card.variantId = '';
      card.variantControl.hidden = true;
      card.error.hidden = true;
      card.condition.textContent = '';
      card.link.hidden = true;
      card.link.removeAttribute('href');
      card.promptController?.abort();
      card.details.open = false;
      card.details.hidden = true;
      card.promptUrl = '';
      card.promptText.textContent = '';
    });
    setStatus('Loading scene…', true);
    try {
      const loaded = await sceneStore.load(selected.data);
      if (!loaded || selected !== scene()) return;
      if (loaded.id !== selected.id) throw new Error('scene');
      currentScene = loaded;
      setSceneLoading(false);
      renderComparison();
    } catch (error) {
      if (selected !== scene()) return;
      board.setAttribute('aria-busy', 'false');
      setStatus('This scene could not be loaded. Try again or choose another scene.', true);
      $('#retry-scene').hidden = false;
    }
  }
  function showProtocol(index) {
    const previous = cards.map((card) => card.modelId);
    if (previous.length) savedMethods.set(protocol().id, previous);
    protocolIndex = index;
    currentScene = null;
    player.setMedia([]);
    cards.splice(0).forEach(disposeCard);
    const available = protocolModels().map((model) => model.id);
    const remembered = (savedMethods.get(protocol().id) || previous).filter((id) => available.includes(id));
    (remembered.length ? remembered : available.slice(0, 2)).forEach(createMethodCard);
    const dataset = protocol().dataset || 'single-view';
    savedProtocols.set(dataset, index);
    $('#protocol-tabs').hidden = dataset !== 'single-view';
    document.querySelectorAll('[data-dataset]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.dataset === dataset));
      button.disabled = !data.protocols.some((item) => (item.dataset || 'single-view') === button.dataset.dataset);
    });
    document.querySelectorAll('[data-protocol]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.protocol === protocol().id)));
    sceneSelect.replaceChildren();
    const groups = new Map();
    protocol().scenes.forEach((current) => {
      if (!groups.has(current.domain)) {
        const group = document.createElement('optgroup');
        group.label = current.domain;
        groups.set(current.domain, group);
        sceneSelect.append(group);
      }
      const option = document.createElement('option');
      option.value = current.id;
      option.textContent = current.title;
      groups.get(current.domain).append(option);
    });
    showScene(0);
  }
  document.querySelectorAll('[data-protocol]').forEach((button) => button.addEventListener('click', () => {
    const index = data.protocols.findIndex((item) => item.id === button.dataset.protocol);
    if (index !== protocolIndex) showProtocol(index);
  }));
  document.querySelectorAll('[data-dataset]').forEach((button) => button.addEventListener('click', () => {
    const dataset = button.dataset.dataset;
    const index = savedProtocols.get(dataset) ?? data.protocols.findIndex((item) => (item.dataset || 'single-view') === dataset);
    if (index >= 0 && index !== protocolIndex) showProtocol(index);
  }));
  sceneSelect.addEventListener('change', () => showScene(protocol().scenes.findIndex((item) => item.id === sceneSelect.value)));
  referenceSelect.addEventListener('change', () => { reference = referenceSelect.value; renderComparison(); });
  qualitySelect.addEventListener('change', () => {
    if (!currentScene || !['480', '720'].includes(qualitySelect.value)) return;
    const position = player.time;
    const resume = player.playing || (player.busy && ['loading', 'buffering'].includes(player.state));
    const wasLoaded = player.busy || player.media.some(({video}) => video.getAttribute('src'));
    quality = qualitySelect.value;
    try { localStorage.setItem('prowbench-video-quality', quality); } catch (_) {}
    renderComparison({position});
    if (resume) player.start();
    else if (wasLoaded || position > 0) player.seek(position);
  });
  $('#previous-scene').addEventListener('click', () => showScene(sceneIndex - 1));
  $('#next-scene').addEventListener('click', () => showScene(sceneIndex + 1));
  $('#retry-scene').addEventListener('click', () => showScene(sceneIndex));
  playButton.addEventListener('click', () => {
    if (player.playing || player.busy) player.pause();
    else player.start();
  });
  $('#restart-all').addEventListener('click', () => player.reset());
  timeline.addEventListener('input', () => { const value = Number(timeline.value); player.pause('Release the timeline to show this moment.'); player.showTime(value); });
  timeline.addEventListener('change', () => player.seek(Number(timeline.value)));
  inputVideo.muted = true;
  inputVideo.addEventListener('loadstart', () => { inputError.hidden = true; });
  inputVideo.addEventListener('error', () => { if (inputVideo.getAttribute('src')) inputError.hidden = false; });
  inputImage.addEventListener('error', () => { if (!inputImage.hidden && inputImage.getAttribute('src')) inputError.hidden = false; });
  showProtocol(0);
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) player.suspend('Playback paused while the comparison is off screen.');
    }, {threshold: .05});
    observer.observe(board);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) player.suspend('Playback paused while this tab is in the background.');
  });
  window.addEventListener('pagehide', () => {
    player.suspend();
    sceneStore.controller?.abort();
    cards.forEach((card) => { card.promptController?.abort(); card.details.open = false; });
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted && !currentScene) showScene(sceneIndex);
  });
})();
