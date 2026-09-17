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
//      v4：预缓存策略重做。原实现用 cache.add(new Request(url, {cache:'reload'}))
//          强制绕过 HTTP 缓存，等于把首页刚刚下载过的 ~1MB 资源**又下了一遍**，
//          首屏期间和页面自己抢带宽。现在改成：
//            · 尊重 HTTP 缓存（不加 cache:'reload'），首页已下载的资源近乎零成本入缓存；
//            · 客栈页 / 迷宫页的资源（约 120KB）拆成 LAZY，等游戏真正跑起来后由页面
//              发消息再预热，不参与首屏竞争。
//      v5：移动端排版与操作大改 —— index.html / style.css / ui.js / save.js 全动了。
//          方向键改成可折叠（矮屏默认收起）、新增悬浮暂停键、结算界面重排空间预算。
//          不换版本号的话，老访客会拿到「旧 HTML + 新 CSS」这种半新半旧的组合，
//          布局会直接错位。
//      v6：客栈页移动端改布局模型 —— inn.css / inn.js 一起动。
//          房间从「按百分比坐标绝对散落」改成「流式网格」，坐标改由 CSS 变量传递。
//          这两个文件必须成对更新：只换 CSS 不换 JS 会拿到「新网格 + 行内 left/top」，
//          行内值在 relative 定位下会变成偏移量，每个房间都会被推歪。
//          同时给 maze-style.css 补了安全区与 dvh（和 style.css / inn.css 统一）。
const CACHE_VERSION = 'v6';
const CACHE_NAME = 'shier-shengxiao-' + CACHE_VERSION;

// 首页自己的资源。这些文件在这次访问中**已经被页面请求过了**，
// 所以 SW 入缓存时能直接命中 HTTP 缓存，几乎不产生额外流量。
const PRECACHE_CORE = [
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
  'eat2.mp3'
];

// 客栈页 / 迷宫页的资源。只有玩家真的会点进去时才需要，
// 放到首屏之后再预热，避免"打开首页先把客栈和迷宫也下一遍"。
const PRECACHE_LAZY = [
  'inn.html',
  'inn.css',
  'inn.js',
  'maze.html',
  'maze-style.css',
  'maze.js',
  'maze-data.js'
];

const HTML_TIMEOUT = 1500;   // HTML 走网络时最多等多久（毫秒），超时就用缓存

// 把一组 URL 塞进缓存。**不加 cache:'reload'** —— 让浏览器优先用 HTTP 缓存，
// 首页刚下过的文件不会白下一遍。单个失败不影响整体。
async function addAll(cache, urls) {
  await Promise.all(urls.map((url) =>
    cache.add(url).catch(() => {})
  ));
}

// ---------- 安装：预缓存首屏核心资源 ----------
self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await addAll(cache, PRECACHE_CORE);
    // 新版本立即接管，不等旧页面全部关闭
    await self.skipWaiting();
  })());
});

// ---------- 页面可以主动要求预热客栈 / 迷宫资源 ----------
// 游戏跑起来之后（loading 遮罩撤掉、画面稳定）页面发 {type:'warm-lazy'} 过来，
// 这时带宽已经空出来了，正好把跳转要用的东西备好，做到"点客栈秒开"。
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'warm-lazy') return;
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await addAll(cache, PRECACHE_LAZY);
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
