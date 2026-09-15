// ==========================================================================
// 🔧 Service Worker —— 让手机端"点进客栈 / 进迷宫"变成秒开
// --------------------------------------------------------------------------
// 背景：这个游戏是多页应用（index / inn / maze）。每次跳转都是一次完整的页面导航，
// 会把 CSS、JS、图集、音效重新请求一遍。弱网下，每次跳转都像"重新加载整个游戏"。
//
// 有了 SW 之后：
//   · 第一次打开 index.html 时，就把客栈页、迷宫页要用的资源**一起预缓存**下来；
//   · 之后任何一次页面跳转，这些资源都由本地缓存直接命中，**零网络、零流量**。
//
// 缓存策略：
//   · HTML      —— 网络优先（最多等 1.5 秒），失败回退缓存。
//                  保证在线时内容永远是最新的，弱网时也能立刻打开。
//   · 静态资源  —— 缓存优先。命中就直接返回，**绝不后台重下**。
//                  （曾经用 stale-while-revalidate，结果每次跳转都把 JS/CSS/BGM
//                    重新下载一遍，白烧手机流量，已改掉。）
//   · 跨域请求  —— 直接放行不插手（AI 接口、排行榜接口等）。
//   · BGM       —— 不预缓存，第一次真正播放到才下载，之后一直走缓存。
//
// ⚠️⚠️ 改了任何 js / css / 图片 / 音频之后，**必须把下面的 CACHE_VERSION 加一**
//      （比如 'v1' → 'v2'）。因为资源是缓存优先，不换版本号访问者会一直用旧缓存。
//      改这个文件本身会让浏览器重新安装 SW，从而自动重新预缓存全部资源。
// ==========================================================================

//      v3：加入咕嘎皮肤 —— 图集被重新打包，assets/atlas.png 与 assets/atlas.js
//          的帧坐标必须成对更新，不换版本号老访客会拿到"新帧表 + 旧图集"，画面全错。
const CACHE_VERSION = 'v3';
const CACHE_NAME = 'shier-shengxiao-' + CACHE_VERSION;

// 预缓存清单：这些资源决定了"跳转是否秒开"
const PRECACHE = [
  './',
  'index.html',
  'style.css',
  'data.js',
  'save.js',
  'game.js',
  'ui.js',
  'assets/atlas.js',
  'assets/atlas.png',
  'favicon.png',
  'eat1.mp3',
  'eat2.mp3',
  'inn.html',
  'inn.css',
  'inn.js',
  'maze.html',
  'maze-style.css',
  'maze.js',
  'maze-data.js'
];

const HTML_TIMEOUT = 1500;   // HTML 走网络时最多等多久（毫秒），超时就用缓存

// ---------- 安装：预缓存核心资源 ----------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // 逐个添加：个别文件缺失（比如某个页面暂时没上传）不影响整体安装
    await Promise.all(PRECACHE.map((url) =>
      cache.add(new Request(url, { cache: 'reload' })).catch(() => {})
    ));
    // 新版本立即接管，不等旧页面全部关闭
    await self.skipWaiting();
  })());
});

// ---------- 激活：清掉旧版本缓存 ----------
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const accept = request.headers.get('accept') || '';
  return accept.indexOf('text/html') !== -1;
}

// 网络优先（带超时），失败回退缓存
async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const fresh = await Promise.race([
      fetch(request),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), HTML_TIMEOUT))
    ]);
    if (fresh && fresh.ok) cache.put(request, fresh.clone()).catch(() => {});
    return fresh;
  } catch (err) {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    throw err;
  }
}

// 缓存优先：命中直接返回，不发起任何后台请求。
// 资源更新靠"改 CACHE_VERSION → SW 重新安装 → 重新预缓存"来保证，
// 而不是靠每次访问重下一遍。
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const resp = await fetch(request);
  if (resp && resp.ok) cache.put(request, resp.clone()).catch(() => {});
  return resp;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }

  // 跨域资源（AI 接口 / 排行榜 / 任何第三方）一律不插手
  if (url.origin !== self.location.origin) return;

  // Range 请求（音视频拖进度条用）直接放行，交给浏览器原生处理。
  // Cache API 不区分 Range，硬拦下来回一个 200 全量响应，可能让播放器行为异常。
  if (req.headers.has('range')) return;

  if (isHtmlRequest(req)) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});
