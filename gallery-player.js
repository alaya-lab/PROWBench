/* A bounded group player: no media URL is attached until play or seek. */
(() => {
  'use strict';
  // Some static hosts ignore byte ranges. Fully buffer only the selected small
  // previews so native players can seek without relying on HTTP Range support.
  class GalleryMediaSource {
    constructor({fetcher = (...args) => fetch(...args), createURL = (blob) => URL.createObjectURL(blob), revokeURL = (url) => URL.revokeObjectURL(url), maxBytes = 4 * 1024 * 1024, timeoutMs = 30000} = {}) {
      Object.assign(this, {fetcher, createURL, revokeURL, maxBytes, timeoutMs});
      this.entries = new Map();
    }
    release(video) {
      const entry = this.entries.get(video);
      if (!entry) return;
      this.entries.delete(video);
      this.revokeURL(entry.url);
    }
    async load(video, src, signal) {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      const cached = this.entries.get(video);
      if (cached?.src === src && !video.error) return cached.url;
      this.release(video);
      const controller = new AbortController();
      const cancel = () => controller.abort();
      signal.addEventListener('abort', cancel, {once: true});
      let timedOut = false;
      let timer;
      const progress = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { timedOut = true; controller.abort(); }, this.timeoutMs);
      };
      progress();
      try {
        const response = await this.fetcher(src, {signal: controller.signal, credentials: 'same-origin'});
        progress();
        if (!response.ok || /text\/html/i.test(response.headers.get('content-type') || '')) throw new Error('media');
        if (Number(response.headers.get('content-length')) > this.maxBytes) throw new Error('size');
        const chunks = [];
        let size = 0;
        const reader = response.body.getReader();
        try {
          while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            if (value.byteLength) progress();
            size += value.byteLength;
            if (size > this.maxBytes) throw new Error('size');
            chunks.push(value);
          }
        } finally { reader.releaseLock(); }
        if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
        if (timedOut) throw new Error('timeout');
        if (!size) throw new Error('media');
        const url = this.createURL(new Blob(chunks, {type: 'video/mp4'}));
        this.entries.set(video, {src, url});
        return url;
      } catch (error) {
        if (timedOut && !signal.aborted) throw new Error('timeout');
        throw error;
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
        controller.abort();
      }
    }
  }
  class GalleryPlayer {
    constructor({onState = () => {}, onTime = () => {}, requestFrame, cancelFrame, maxParallelLoads = 3, mediaSource = null} = {}) {
      this.onState = onState;
      this.onTime = onTime;
      this.requestFrame = requestFrame || ((fn) => requestAnimationFrame(fn));
      this.cancelFrame = cancelFrame || ((id) => cancelAnimationFrame(id));
      this.media = [];
      this.duration = 5;
      this.time = 0;
      this.playing = false;
      this.busy = false;
      this.state = 'idle';
      this.frame = 0;
      this.controller = null;
      this.maxParallelLoads = Math.max(1, Math.floor(maxParallelLoads) || 3);
      this.mediaSource = mediaSource;
    }
    emit(state, message) {
      this.state = state;
      this.onState(state, message);
    }
    showTime(value) {
      this.time = Math.max(0, Math.min(this.duration, value));
      this.onTime(this.time, this.duration);
    }
    stop() {
      this.controller?.abort();
      this.controller = null;
      this.playing = false;
      this.busy = false;
      this.cancelFrame(this.frame);
      this.frame = 0;
      this.media.forEach(({video}) => { video.pause(); video.playbackRate = 1; });
    }
    pause(message = 'Playback paused.') {
      const wasLoading = this.busy;
      this.stop();
      if (wasLoading) this.releaseMedia();
      this.emit('paused', message);
    }
    releaseVideo(video) {
      if (video.getAttribute('src')) {
        video.removeAttribute('src');
        video.preload = 'none';
        video.load();
      }
      this.mediaSource?.release(video);
    }
    releaseMedia() {
      this.media.forEach(({video}) => this.releaseVideo(video));
    }
    suspend(message = 'Playback paused.') {
      this.stop();
      this.releaseMedia();
      this.emit('paused', message);
    }
    setMedia(media, duration = 5, {retainUnchanged = false, position = 0} = {}) {
      this.stop();
      const target = Math.max(0, Math.min(duration, position));
      const retained = new Map(media.map((item) => [item.video, item.src]));
      this.media.forEach(({video, src, waiting, error}) => {
        video.removeEventListener('waiting', waiting);
        video.removeEventListener('error', error);
        if (retainUnchanged && retained.get(video) === src) {
          if (video.readyState >= 1 && video.currentTime !== target) video.currentTime = Math.min(target, Math.max(0, video.duration - .025));
        } else {
          this.releaseVideo(video);
        }
      });
      this.duration = duration;
      this.media = media.map((item) => {
        const waiting = () => {
          if (!this.playing) return;
          this.showTime(this.media[0].video.currentTime);
          this.start('buffering');
        };
        const error = () => {
          if (!this.playing) return;
          this.stop();
          this.releaseMedia();
          this.emit('error', 'A video could not be loaded. Try again or open its video link.');
        };
        item.video.addEventListener('waiting', waiting);
        item.video.addEventListener('error', error);
        return {...item, waiting, error};
      });
      this.showTime(target);
      this.emit('idle', 'Press Play comparison to load the selected videos.');
    }
    waitFor(video, predicate, events, signal) {
      if (signal.aborted) return Promise.reject(new DOMException('Cancelled', 'AbortError'));
      if (video.error) return Promise.reject(new Error('media'));
      if (predicate()) return Promise.resolve();
      return new Promise((resolve, reject) => {
        const finish = (error) => {
          clearTimeout(timer);
          events.forEach((name) => video.removeEventListener(name, check));
          video.removeEventListener('error', failed);
          signal.removeEventListener('abort', cancelled);
          error ? reject(error) : resolve();
        };
        const check = () => { if (predicate()) finish(); };
        const failed = () => finish(new Error('media'));
        const cancelled = () => finish(new DOMException('Cancelled', 'AbortError'));
        const timer = setTimeout(() => finish(new Error('timeout')), 20000);
        events.forEach((name) => video.addEventListener(name, check));
        video.addEventListener('error', failed);
        signal.addEventListener('abort', cancelled, {once: true});
      });
    }
    async load(item, signal) {
      const {video, src} = item;
      const playable = this.mediaSource ? await this.mediaSource.load(video, src, signal) : src;
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (video.getAttribute('src') !== playable || video.error) {
        video.preload = 'auto';
        video.src = playable;
        video.load();
      }
    }
    async eachMedia(signal, action) {
      // Bound initial buffering and seek work, even with every method selected.
      const media = this.media.slice();
      let next = 0;
      const worker = async () => {
        while (next < media.length && !signal.aborted) {
          const item = media[next++];
          await action(item);
        }
      };
      await Promise.all(Array.from({length: Math.min(this.maxParallelLoads, media.length)}, worker));
    }
    prepare(signal, readyState, events) {
      return this.eachMedia(signal, async (item) => {
        await this.load(item, signal);
        return this.waitFor(item.video, () => item.video.readyState >= readyState, events, signal);
      });
    }
    async seekVideo(video, target, signal) {
      const value = Math.min(target, Math.max(0, video.duration - .025));
      if (Math.abs(video.currentTime - value) < .01 && !video.seeking) return;
      video.currentTime = value;
      await this.waitFor(video, () => !video.seeking && Math.abs(video.currentTime - value) < .1, ['seeked'], signal);
    }
    begin(state) {
      this.stop();
      this.controller = new AbortController();
      this.busy = true;
      this.emit(state);
      return this.controller.signal;
    }
    fail(error, signal) {
      if (signal.aborted || error.name === 'AbortError') return;
      this.stop();
      this.releaseMedia();
      this.emit('error', error.message === 'timeout' ? 'Loading is taking longer than expected. Press Play comparison to retry.' : 'A video could not be played. Try again or open its video link.');
    }
    async start(state = 'loading') {
      if (!this.media.length) return;
      const target = this.time >= this.duration - .04 ? 0 : this.time;
      const signal = this.begin(state);
      try {
        await this.prepare(signal, 3, ['canplay', 'loadeddata']);
        if (signal.aborted) return;
        await this.eachMedia(signal, ({video}) => this.seekVideo(video, target, signal));
        if (signal.aborted) return;
        await Promise.all(this.media.map(({video}) => video.play()));
        if (signal.aborted) return;
        this.busy = false;
        this.playing = true;
        this.showTime(target);
        this.emit('playing');
        this.tick();
      } catch (error) { this.fail(error, signal); }
    }
    async seek(value) {
      if (!this.media.length) return;
      const signal = this.begin('seeking');
      this.showTime(value);
      const target = this.time;
      try {
        await this.prepare(signal, 1, ['loadedmetadata']);
        if (signal.aborted) return;
        await this.eachMedia(signal, ({video}) => this.seekVideo(video, target, signal));
        if (signal.aborted) return;
        this.busy = false;
        this.emit('paused', 'Playback paused at the selected time.');
      } catch (error) { this.fail(error, signal); }
    }
    reset() {
      this.stop();
      this.showTime(0);
      this.media.forEach(({video}) => { if (video.readyState >= 1) video.currentTime = 0; });
      this.emit('paused', 'At the beginning. Press Play comparison to start.');
    }
    tick() {
      if (!this.playing) return;
      const master = this.media[0].video;
      if (master.ended || master.currentTime >= this.duration - .025) {
        this.stop();
        this.showTime(this.duration);
        this.emit('ended', 'End of the comparison. Press Replay to watch again.');
        return;
      }
      this.showTime(master.currentTime);
      this.media.slice(1).forEach(({video}) => {
        const drift = video.currentTime - master.currentTime;
        if (Math.abs(drift) > .12 && !video.seeking && video.readyState >= 3) video.currentTime = master.currentTime;
        else video.playbackRate = Math.abs(drift) > .035 ? (drift > 0 ? .98 : 1.02) : 1;
      });
      this.frame = this.requestFrame(() => this.tick());
    }
  }
  GalleryPlayer.MediaSource = GalleryMediaSource;
  GalleryPlayer.selectRendition = (entry, quality) => entry ? {...entry, ...entry.qualities?.[String(quality)]} : null;
  if (typeof module !== 'undefined' && module.exports) module.exports = GalleryPlayer;
  else window.PROWBenchGalleryPlayer = GalleryPlayer;
})();
