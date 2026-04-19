/**
 * photos.js — loads images from the local /photos/ directory
 * Works with Python's built-in HTTP server directory listing
 */

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|webp|gif|avif)$/i;

/**
 * Fetch all images from /photos/ directory
 * @returns {Promise<Array<{url: string, name: string}>>}
 */
async function loadPhotosDirectory() {
  try {
    const res = await fetch('/photos/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = [...doc.querySelectorAll('a[href]')]
      .map(a => a.getAttribute('href'))
      .filter(href => IMAGE_EXTENSIONS.test(href));

    return links.map(href => ({
      url: `/photos/${href}`,
      name: decodeURIComponent(href).replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ')
    }));
  } catch (err) {
    console.warn('[photos.js] Could not load /photos/ directory:', err.message);
    return [];
  }
}

/**
 * Render a photo grid into a container element
 * @param {HTMLElement} container
 * @param {Array<{url: string, name: string}>} photos
 * @param {Object} opts
 * @param {function} opts.onSelect  - called with photo object when clicked
 */
function renderPhotoGrid(container, photos, opts = {}) {
  if (!photos.length) {
    container.innerHTML = `
      <div style="text-align:center; padding: 48px 24px; color: #888; font-family: 'Manrope', sans-serif;">
        <div style="font-size: 48px; margin-bottom: 16px;">📂</div>
        <p style="font-size: 14px; margin: 0 0 8px;">No photos yet</p>
        <p style="font-size: 12px; color: #555;">Drop your fashion photos into the <code style="background:#1a1a1a; padding:2px 6px; border-radius:4px;">photos/</code> folder</p>
      </div>`;
    return;
  }

  container.innerHTML = photos.map((p, i) => `
    <div class="photo-thumb" data-index="${i}" style="
      position: relative;
      aspect-ratio: 3/4;
      overflow: hidden;
      border-radius: 8px;
      cursor: pointer;
      background: #1a1a1a;
      transition: transform 0.2s, box-shadow 0.2s;
    " onmouseover="this.style.transform='scale(1.03)';this.style.boxShadow='0 12px 32px rgba(0,0,0,0.6)'"
       onmouseout="this.style.transform='scale(1)';this.style.boxShadow='none'"
       onclick="${opts.onSelect ? `window.__photoSelect(${i})` : ''}">
      <img src="${p.url}" alt="${p.name}" loading="lazy" style="
        width:100%; height:100%; object-fit:cover; display:block;
      " onerror="this.parentElement.style.display='none'"/>
      <div style="
        position:absolute; bottom:0; left:0; right:0;
        background: linear-gradient(transparent, rgba(0,0,0,0.7));
        padding: 16px 8px 8px;
        font-family: 'Manrope', sans-serif;
        font-size: 11px;
        color: rgba(255,255,255,0.8);
        text-transform: capitalize;
      ">${p.name}</div>
    </div>
  `).join('');

  if (opts.onSelect) {
    window.__photoSelect = (i) => opts.onSelect(photos[i], i);
  }
}

export { loadPhotosDirectory, renderPhotoGrid };
