// Injected into every page via addInitScript. Renders a fake cursor, click
// ripples, caption bar, title/outro cards, and element-targeted zoom — all in a
// layer parented to <html> so page-level (body) zoom transforms never touch it.
// Exposes an async window.__vid API; each method resolves when its animation is
// done so the Node driver can await it and the recorder captures every frame.
(() => {
  if (window.__vid) return;
  const NS = {};
  window.__vid = NS;

  const CURSOR_SVG =
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">' +
        '<path d="M5 2l0 20 5-5 3 7 3-1-3-7 7 0z" fill="white" stroke="black" stroke-width="1.5" stroke-linejoin="round"/></svg>',
    );

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  NS.wait = wait;

  let layer, cursor, caption, card;
  NS.state = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

  // Paint a dark brand backdrop on <html> so the load flash reads as brand,
  // not white. The app's own (opaque) background covers it once rendered.
  try { document.documentElement.style.background = '#0e0e16'; } catch {}

  function build() {
    const parent = document.documentElement || document.body;
    if (!parent) return; // document-start: retry on next API call
    if (layer && parent.contains(layer)) return;
    layer = document.createElement('div');
    layer.id = '__vid_layer';
    Object.assign(layer.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647',
      pointerEvents: 'none', overflow: 'hidden',
    });

    cursor = document.createElement('img');
    cursor.src = CURSOR_SVG;
    Object.assign(cursor.style, {
      position: 'absolute', left: '0', top: '0', width: '28px', height: '28px',
      transform: `translate(${NS.state.x}px,${NS.state.y}px)`,
      transformOrigin: '4px 2px', transition: 'none',
      filter: 'drop-shadow(0 2px 4px rgba(0,0,0,.35))', willChange: 'transform',
    });

    caption = document.createElement('div');
    Object.assign(caption.style, {
      position: 'absolute', left: '50%', bottom: '48px', transform: 'translate(-50%,12px)',
      maxWidth: '78%', padding: '14px 24px', borderRadius: '14px',
      background: 'rgba(17,17,19,.92)', color: '#fff',
      font: '500 20px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
      letterSpacing: '.2px', textAlign: 'center', opacity: '0',
      transition: 'opacity .4s ease, transform .4s ease',
      boxShadow: '0 8px 30px rgba(0,0,0,.35)', backdropFilter: 'blur(2px)',
    });

    card = document.createElement('div');
    Object.assign(card.style, {
      position: 'absolute', inset: '0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '14px',
      background: 'linear-gradient(135deg,#0b0b0f 0%,#1a1a24 100%)',
      color: '#fff', opacity: '0', transition: 'opacity .5s ease',
      font: '600 15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    });

    layer.append(caption, cursor, card);
    parent.appendChild(layer);
  }
  build();
  document.addEventListener('DOMContentLoaded', build);

  NS.moveTo = (x, y, dur = 700) =>
    new Promise((res) => {
      build();
      const sx = NS.state.x, sy = NS.state.y, dx = x - sx, dy = y - sy, t0 = performance.now();
      (function frame(now) {
        const p = Math.min(1, (now - t0) / dur), e = ease(p);
        NS.state.x = sx + dx * e; NS.state.y = sy + dy * e;
        cursor.style.transform = `translate(${NS.state.x}px,${NS.state.y}px)`;
        p < 1 ? requestAnimationFrame(frame) : res();
      })(t0);
    });

  NS.click = async () => {
    build();
    const r = document.createElement('div');
    Object.assign(r.style, {
      position: 'absolute', left: NS.state.x + 'px', top: NS.state.y + 'px',
      width: '14px', height: '14px', marginLeft: '-7px', marginTop: '-7px',
      borderRadius: '50%', border: '2px solid rgba(59,130,246,.9)',
      background: 'rgba(59,130,246,.25)', transform: 'scale(.3)', opacity: '1',
      transition: 'transform .45s cubic-bezier(.2,.8,.2,1), opacity .45s ease',
    });
    layer.appendChild(r);
    cursor.style.transform = `translate(${NS.state.x}px,${NS.state.y}px) scale(.82)`;
    requestAnimationFrame(() => { r.style.transform = 'scale(4.2)'; r.style.opacity = '0'; });
    await wait(120);
    cursor.style.transform = `translate(${NS.state.x}px,${NS.state.y}px) scale(1)`;
    await wait(360);
    r.remove();
  };

  NS.caption = async (text, hold = 0) => {
    build();
    caption.style.opacity = '0'; caption.style.transform = 'translate(-50%,12px)';
    await wait(text ? 220 : 0);
    caption.textContent = text || '';
    if (text) {
      caption.style.opacity = '1'; caption.style.transform = 'translate(-50%,0)';
    }
    if (hold) await wait(hold);
  };
  NS.captionHide = async () => {
    if (!caption) return;
    caption.style.opacity = '0'; caption.style.transform = 'translate(-50%,12px)';
    await wait(300);
  };

  NS.card = async (title, subtitle, hold = 1800) => {
    build();
    card.innerHTML =
      `<div style="font:700 44px/1.1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;letter-spacing:-.5px">${title}</div>` +
      (subtitle ? `<div style="font:400 20px/1.4 -apple-system;opacity:.72">${subtitle}</div>` : '');
    card.style.opacity = '1';
    await wait(hold);
  };
  NS.cardHide = async () => { if (card) { card.style.opacity = '0'; await wait(520); } };

  NS.zoom = async (cx, cy, scale = 1.55, dur = 620) => {
    const html = document.documentElement, body = document.body;
    const ox = cx + window.scrollX, oy = cy + window.scrollY;
    body.style.transformOrigin = `${ox}px ${oy}px`;
    body.style.transition = `transform ${dur}ms cubic-bezier(.4,0,.2,1)`;
    html.style.overflow = 'hidden';
    requestAnimationFrame(() => { body.style.transform = `scale(${scale})`; });
    await wait(dur + 40);
  };
  NS.zoomOut = async (dur = 520) => {
    const html = document.documentElement, body = document.body;
    body.style.transition = `transform ${dur}ms cubic-bezier(.4,0,.2,1)`;
    body.style.transform = 'none';
    await wait(dur + 40);
    html.style.overflow = '';
  };
})();
