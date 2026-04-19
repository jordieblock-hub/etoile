/**
 * pinterest.js — fetches real pin images from a Pinterest board
 * Uses CORS proxies since Pinterest blocks direct browser fetches
 */

const DEFAULT_BOARD = 'https://www.pinterest.com/jordieblock/cloet/';

const CORS_PROXIES = [
  url => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  url => `https://corsproxy.io/?${encodeURIComponent(url)}`,
  url => `https://thingproxy.freeboard.io/fetch/${encodeURIComponent(url)}`,
];

/**
 * Try each proxy until one returns valid HTML
 */
async function fetchViaProxy(targetUrl) {
  for (const makeProxyUrl of CORS_PROXIES) {
    try {
      const proxyUrl = makeProxyUrl(targetUrl);
      const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;

      const data = await res.json().catch(() => null);
      // allorigins wraps in { contents: "..." }
      if (data && data.contents) return data.contents;

      const text = await res.text();
      if (text && text.length > 500) return text;
    } catch (e) {
      console.warn(`[pinterest.js] Proxy failed:`, e.message);
    }
  }
  throw new Error('All CORS proxies failed');
}

/**
 * Extract image URLs from Pinterest HTML
 * Tries __PWS_DATA__ JSON first, falls back to i.pinimg.com regex
 */
function extractPinImages(html) {
  const images = new Set();

  // 1. Try __PWS_DATA__ JSON blob (Pinterest's server-side data)
  try {
    const match = html.match(/__PWS_DATA__\s*=\s*(\{.+?\})(?=\s*<\/script>)/s);
    if (match) {
      const json = JSON.parse(match[1]);
      const str = JSON.stringify(json);
      const imgMatches = str.match(/https:\/\/i\.pinimg\.com\/[^"]+\.jpg/g) || [];
      imgMatches.forEach(u => {
        // prefer 736x (medium) or 564x over tiny thumbnails
        if (!u.includes('/30x30/') && !u.includes('/60x60/')) {
          images.add(u);
        }
      });
    }
  } catch (e) { /* ignore parse errors */ }

  // 2. Regex fallback — scrape any i.pinimg.com URL from the raw HTML
  if (images.size < 5) {
    const re = /https:\/\/i\.pinimg\.com\/(?:736x|564x|originals)\/[^\s"'\\]+\.(?:jpg|jpeg|png|webp)/gi;
    let m;
    while ((m = re.exec(html)) !== null) {
      images.add(m[0]);
    }
  }

  // 3. og:image tags as last resort
  if (images.size < 3) {
    const ogRe = /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/gi;
    let m;
    while ((m = ogRe.exec(html)) !== null) {
      images.add(m[1]);
    }
  }

  // Deduplicate by pin ID (last path segment before extension)
  const seen = new Set();
  const unique = [];
  for (const url of images) {
    const id = url.split('/').pop().split('.')[0];
    if (!seen.has(id)) {
      seen.add(id);
      unique.push(url);
    }
  }

  return unique.slice(0, 40); // cap at 40 pins
}

/**
 * Upgrade an image URL to the best available size
 */
function upgradePinUrl(url) {
  return url
    .replace(/\/[0-9]+x[0-9]+\//, '/736x/')
    .replace(/\/60x60\//, '/736x/')
    .replace(/\/30x30\//, '/736x/');
}

/**
 * Main export — fetch images from a Pinterest board URL
 * @param {string} boardUrl  e.g. "https://www.pinterest.com/jordieblock/cloet/"
 * @returns {Promise<string[]>}  array of image URLs
 */
async function fetchPinterestImages(boardUrl) {
  const url = boardUrl || localStorage.getItem('pinterest_url') || DEFAULT_BOARD;
  const normalized = url.replace(/\/?$/, '/'); // ensure trailing slash

  const html = await fetchViaProxy(normalized);
  const images = extractPinImages(html);
  return images.map(upgradePinUrl);
}

/**
 * Render a Pinterest board grid into a container element
 * @param {HTMLElement} container
 * @param {string[]} images  array of image URLs
 * @param {Object} opts
 * @param {function} opts.onSelect  called with image URL when clicked
 */
function renderPinGrid(container, images, opts = {}) {
  if (!images.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 32px 16px; color: #aaa; font-family:'Manrope',sans-serif; font-size:13px;">
        <div style="font-size:36px; margin-bottom:12px;">📌</div>
        <p>Couldn't load pins from this board.</p>
        <p style="font-size:11px; color:#666; margin-top:4px;">Pinterest may have blocked the request. Try a public board URL.</p>
      </div>`;
    return;
  }

  container.innerHTML = images.map((src, i) => `
    <div class="pin-thumb" data-index="${i}" style="
      aspect-ratio: 3/4;
      overflow: hidden;
      border-radius: 6px;
      cursor: pointer;
      background: #1a1a1a;
      transition: transform 0.2s, box-shadow 0.2s;
      position: relative;
    " onmouseover="this.style.transform='scale(1.04)';this.style.boxShadow='0 8px 24px rgba(0,0,0,0.5)'"
       onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'"
       onclick="${opts.onSelect ? `window.__pinSelect(${i})` : ''}">
      <img src="${src}" alt="Pin ${i + 1}" loading="lazy" crossorigin="anonymous" style="
        width:100%; height:100%; object-fit:cover; display:block;
      " onerror="this.parentElement.style.display='none'"/>
    </div>
  `).join('');

  if (opts.onSelect) {
    window.__pinSelect = (i) => opts.onSelect(images[i], i);
  }
}

export { fetchPinterestImages, renderPinGrid, DEFAULT_BOARD };
