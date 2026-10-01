/* Only the requested scene is fetched; a small LRU keeps revisits inexpensive. */
(() => {
  'use strict';
  class GallerySceneStore {
    constructor({fetcher = (...args) => fetch(...args), limit = 8} = {}) {
      this.fetcher = fetcher;
      this.limit = limit;
      this.cache = new Map();
      this.controller = null;
    }
    seed(url, scene) {
      this.cache.delete(url);
      this.cache.set(url, scene);
      while (this.cache.size > this.limit) this.cache.delete(this.cache.keys().next().value);
    }
    async load(url) {
      this.controller?.abort();
      const controller = new AbortController();
      this.controller = controller;
      const cached = this.cache.get(url);
      if (cached) {
        this.seed(url, cached);
        return cached;
      }
      const timer = setTimeout(() => controller.abort(new DOMException('Scene request timed out', 'TimeoutError')), 15000);
      try {
        const response = await this.fetcher(url, {signal: controller.signal});
        if (!response.ok) throw new Error('scene');
        const scene = await response.json();
        if (controller.signal.aborted) throw controller.signal.reason;
        const views = scene?.views || (scene?.inputs && scene?.outputs ? [scene] : []);
        if (!scene?.id || !views.length || views.some((view) => !view.inputs || !view.outputs)) throw new Error('scene');
        if (views.length > 1 && (!scene.grid?.inputs || !scene.grid?.outputs ||
          scene.grid.order?.join(',') !== views.map((view) => view.id).join(',') ||
          ['inputs', 'outputs'].some((kind) => Object.keys(views[0][kind]).some((key) => !scene.grid[kind][key]?.src)))) throw new Error('scene grid');
        this.seed(url, scene);
        return scene;
      } catch (error) {
        if (controller.signal.reason?.name === 'TimeoutError') throw controller.signal.reason;
        if (controller.signal.aborted || error.name === 'AbortError') return null;
        throw error;
      } finally { clearTimeout(timer); }
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = GallerySceneStore;
  else window.PROWBenchGallerySceneStore = GallerySceneStore;
})();
