(function (root) {
  "use strict";
  const PREFIX = "nepsis-offline-sync:v1:user:";
  const busy = new Set();

  function storageKey(userId) {
    if (typeof userId !== "string" || !userId) return null;
    return PREFIX + encodeURIComponent(userId);
  }
  function clientId() {
    if (root.crypto && typeof root.crypto.randomUUID === "function") return root.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    if (root.crypto && typeof root.crypto.getRandomValues === "function") root.crypto.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes, value => value.toString(16).padStart(2, "0")).join("").replace(/^(........)(....)(....)(....)(............)$/, "$1-$2-$3-$4-$5");
  }
  function read(userId) {
    const key = storageKey(userId);
    if (!key) return [];
    try {
      const items = JSON.parse(root.localStorage.getItem(key) || "[]");
      return Array.isArray(items) ? items.filter(item => item && item.user_id === userId && typeof item.client_id === "string" && typeof item.type === "string") : [];
    } catch (error) { return []; }
  }
  function write(userId, items) {
    const key = storageKey(userId);
    if (!key) return false;
    try { root.localStorage.setItem(key, JSON.stringify(items)); return true; }
    catch (error) { return false; }
  }
  function enqueue(userId, operation) {
    if (!storageKey(userId) || !operation || typeof operation.type !== "string") return null;
    const item = Object.assign({}, operation, { client_id: clientId(), user_id: userId, queued_at: new Date().toISOString() });
    const items = read(userId);
    items.push(item);
    return write(userId, items) ? item : null;
  }
  function remove(userId, id) {
    const items = read(userId);
    return write(userId, items.filter(item => item.client_id !== id));
  }
  function removeThrough(userId, id, types) {
    const items = read(userId);
    const allowed = new Set(types || []);
    const index = items.findIndex(item => item.client_id === id);
    if (index < 0) return false;
    return write(userId, items.filter((item, itemIndex) => !(itemIndex <= index && allowed.has(item.type))));
  }
  function has(userId, id) { return read(userId).some(item => item.client_id === id); }
  function online() { return typeof navigator === "undefined" || navigator.onLine !== false; }
  async function flush(userId, types, handler, canContinue) {
    const selected = new Set(types || []);
    const lock = storageKey(userId) + ":" + Array.from(selected).sort().join(",");
    if (!storageKey(userId) || busy.has(lock) || !online()) return { sent: 0, blocked: true, error: null };
    busy.add(lock);
    let sent = 0, error = null, blocked = false;
    try {
      while (online() && (!canContinue || canContinue())) {
        const item = read(userId).find(entry => selected.has(entry.type));
        if (!item) break;
        try {
          const ok = await handler(item);
          if (ok !== true) { blocked = true; break; }
          remove(userId, item.client_id);
          sent++;
        } catch (err) { error = err; break; }
      }
      if (!online() || (canContinue && !canContinue())) blocked = true;
    } finally { busy.delete(lock); }
    return { sent, blocked, error };
  }
  root.NepsisOfflineQueue = { clientId, read, enqueue, remove, removeThrough, has, flush };
})(window);
