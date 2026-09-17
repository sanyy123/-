// ==========================================================================
// 🔧 合集首页的 Service Worker —— 只干一件事：让"第二次打开首页"瞬开
// --------------------------------------------------------------------------
// 背景：合集页本身只有几 KB，但每次打开都要重新走一次网络往返
// （DNS → TCP → TLS → TTFB）。弱网 / 移动网络下这一段就能耗掉 1~3 秒，
// 玩家看到的就是一片黑屏在等。
//
// 策略：只接管**首页这一个文档**，用「stale-while-revalidate」——
//   · 有缓存 → 立刻返回缓存（0 网络等待，首帧几乎瞬间）
//   · 同时后台去取最新版，下次打开就是新的
//   其它任何请求（游戏页、CSS、JS、图片、接口）**一律不插手**，
//   交给游戏自己的 SW 和浏览器处理，绝不产生"改了代码但用户看到旧版"的问题。
//
// ⚠️ 只有首页这一个 URL 会被缓存，改动 index.html 无需改版本号也能生效
//    （SWR 会后台自动更新）；改本文件本身则会触发 SW 重装。
// ==========================================================================

const CACHE_NAME = 'guofeng-hall-shell-v1';

// 本 SW 的部署目录。不管是部署在域名根目录还是子目录，都能算对。
const BASE = new URL('./', self.location).pathname;

// 只认这两个路径：目录本身，和显式的 index.html
function isHallShell(pathname) {
  return pathname === BASE || pathname === BASE + 'index.html';
}

// ---------- 安装：不预缓存任何东西 ----------
// 首页文档本来就在这次访问的网络缓存里，等第一次 fetch 事件顺手存下来即可。
// 刻意不在 install 里下载文件 —— 那会和首屏渲染抢带宽，反而更慢。
self.addEventListener('install', () => {
  self.skipWaiting();
});

// ---------- 激活：清掉旧版本缓存 ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // 跨域一律放行
  if (url.origin !== self.location.origin) return;
  // 只接管首页文档，其它全部交还浏览器
  if (!isHallShell(url.pathname)) return;

  // 用纯 URL 字符串做缓存键，不用 navigation 模式的 Request 对象。
  // navigation 请求的 mode 是 'navigate'，直接丢给 cache.put() 在部分浏览器上会报错；
  // 而 Cache 的匹配只看「方法 + URL」，所以用字符串键读写都能命中。
  const key = url.origin + url.pathname;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(key);

    // 后台更新：拿到了就写回缓存，给下一次访问用
    const network = fetch(req).then((resp) => {
      if (resp && resp.ok) cache.put(key, resp.clone()).catch(() => {});
      return resp;
    }).catch(() => null);

    if (cached) return cached;          // 有缓存：立刻返回，不等网络
    const fresh = await network;
    return fresh || Response.error();
  })());
});
