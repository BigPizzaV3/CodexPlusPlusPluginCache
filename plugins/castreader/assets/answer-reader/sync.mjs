// Renderer-only core. It grants no access to another application's DOM.
export function canonicalText(value) {
  let text = '', offsets = [], index = 0;
  for (const source of value) {
    for (const char of source.normalize('NFKC').toLowerCase()) {
      if (/[\p{L}\p{N}]/u.test(char)) {
        text += char;
        for (let j = 0; j < char.length; j++) offsets.push([index, index + source.length]);
      }
    }
    index += source.length;
  }
  return { text, offsets };
}

export function alignWords(source, words) {
  if (!Array.isArray(words) || !words.length) throw Error('Missing real alignment');
  const normalized = canonicalText(source);
  let cursor = 0, previousEnd = 0;
  const mapped = words.map(word => {
    const token = canonicalText(word.word).text;
    if (!token || !Number.isFinite(word.start_time) || !Number.isFinite(word.end_time)
      || word.start_time < previousEnd - 1e-6 || word.end_time <= word.start_time)
      throw Error('Invalid or overlapping timestamps');
    if (normalized.text.slice(cursor, cursor + token.length) !== token)
      throw Error('Audio words do not match original DOM text');
    const start = normalized.offsets[cursor][0];
    cursor += token.length;
    const end = normalized.offsets[cursor - 1][1];
    previousEnd = word.end_time;
    return { ...word, start, end };
  });
  if (cursor !== normalized.text.length) throw Error('Audio does not cover the original text');
  return mapped;
}

export function wordAtTime(words, time) {
  if (!Number.isFinite(time) || time < 0) return -1;
  let lo = 0, hi = words.length - 1, candidate = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (words[mid].start_time <= time) { candidate = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return candidate >= 0 && time < words[candidate].end_time ? candidate : -1;
}

export function attachOriginalTextReader({ root, audio, words, name = 'castreader-speaking', onState = () => {} }) {
  const doc = root.ownerDocument, win = doc.defaultView;
  if (!win.CSS?.highlights || !win.Highlight) throw Error('Host has no CSS Highlight API');
  if (!root.isConnected) throw Error('Original answer is detached');
  const walker = doc.createTreeWalker(root, win.NodeFilter.SHOW_TEXT);
  const nodes = []; let node, source = '';
  while ((node = walker.nextNode())) {
    nodes.push({ node, start: source.length, end: source.length + node.data.length });
    source += node.data;
  }
  const mapped = alignWords(source, words);
  const ranges = mapped.map(word => {
    const first = nodes.find(n => n.end > word.start);
    const last = nodes.find(n => n.end >= word.end && n.start < word.end);
    if (!first || !last) throw Error('Word has no DOM range');
    const range = doc.createRange();
    range.setStart(first.node, word.start - first.start);
    range.setEnd(last.node, word.end - last.start);
    return range;
  });
  let frame = 0, active = -1, disposed = false, stopped = false, error = null;
  const snapshot = () => ({ active, word: active >= 0 ? mapped[active].word : null,
    rangeText: active >= 0 ? ranges[active].toString() : null,
    currentTime: audio.currentTime, rate: audio.playbackRate, paused: audio.paused,
    disposed, stopped, error, connected: root.isConnected });
  function clear() { win.CSS.highlights.delete(name); active = -1; }
  function invalidate(reason) {
    error = reason; dispose(); onState(snapshot());
  }
  function render() {
    if (disposed) return;
    if (!root.isConnected || root.textContent !== source || nodes.some(n => !root.contains(n.node))) {
      invalidate('Original answer changed or detached'); return;
    }
    const next = stopped || audio.ended ? -1 : wordAtTime(mapped, audio.currentTime);
    if (next !== active) {
      active = next;
      if (active < 0) clear();
      else win.CSS.highlights.set(name, new win.Highlight(ranges[active]));
    }
    onState(snapshot());
  }
  function tick() {
    frame = 0; render();
    if (!disposed && !audio.paused && !audio.ended) frame = win.requestAnimationFrame(tick);
  }
  function update(event) {
    if (event?.type === 'play') stopped = false;
    win.cancelAnimationFrame(frame); frame = 0; render();
    if (!disposed && !audio.paused && !audio.ended) frame = win.requestAnimationFrame(tick);
  }
  const events = ['play','pause','seeking','seeked','ratechange','ended','timeupdate','loadedmetadata'];
  for (const event of events) audio.addEventListener(event, update);
  const onError = () => invalidate('Audio playback failed');
  audio.addEventListener('error', onError);
  const observer = new win.MutationObserver(render);
  observer.observe(root, { childList: true, subtree: true, characterData: true });
  // Detect removal of the answer's ancestor without polling the entire host DOM.
  const removalObserver = new win.MutationObserver(() => { if (!root.isConnected) render(); });
  removalObserver.observe(doc.documentElement, { childList: true, subtree: true });
  function dispose() {
    if (disposed) return;
    disposed = true; win.cancelAnimationFrame(frame); clear();
    observer.disconnect(); removalObserver.disconnect();
    for (const event of events) audio.removeEventListener(event, update);
    audio.removeEventListener('error', onError);
    // A removed reader must not leave untracked audio running after its listeners are gone.
    audio.pause();
  }
  function stop() {
    if (disposed) return;
    // Seeking back to zero emits asynchronous events. Keep highlights suppressed
    // until the next explicit play, including recordings whose first word starts at zero.
    stopped = true; win.cancelAnimationFrame(frame); frame = 0;
    audio.pause(); audio.currentTime = 0; clear(); onState(snapshot());
  }
  render();
  return { snapshot, stop, dispose, ranges, mapped };
}
