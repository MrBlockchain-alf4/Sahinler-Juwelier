/**
 * Sahinler Juwelier – Chatbot Widget
 * German language, Q&A + Gold-Rechner. No data collection, no online
 * appointment booking - visitors are always pointed to visit or call.
 * Embed: <script src="/chatbot/chatbot.js" defer></script>
 */
(function () {
  'use strict';
  if (document.getElementById('sj-cb-root')) return;

  /* ── PALETTE ── */
  const G = {
    gold:     '#D4AF37',
    goldLt:   '#e4c54a',
    goldDim:  'rgba(212,175,55,0.15)',
    goldBdr:  'rgba(212,175,55,0.3)',
    black:    '#0a0a0a',
    blackMid: '#141414',
    blackSoft:'#1e1e1e',
    border:   '#2a2a2a',
    text:     '#e8e8e8',
    muted:    '#888888',
    white:    '#ffffff',
    green:    '#4a9e6f',
    bg:       '#0f0f0f',
    bgOff:    '#181818',
  };

  /* ── BUSINESS DATA ── */
  const BIZ = {
    name:     'Sahinler Juwelier',
    address:  'Elberfelder Str. 79, 58095 Hagen',
    phone:    '+49 163 4460110',
    phoneHref:'tel:+491634460110',
  };

  /* ── GOLD-RECHNER ──
     Reference gold value per gram by purity - this is the shared
     market baseline; the -15% factor below is where the shop's own
     buy-back margin would go. Update GOLD_PER_G with a fresh spot
     price periodically, and adjust the 0.85 factor if the real
     in-store margin differs. */
  const GOLD_PER_G = { '999': 122, '750': 91, '585': 71, '333': 41 };
  function fmtEUR(n) {
    try { return Math.round(n).toLocaleString('de-DE'); } catch (e) { return String(Math.round(n)); }
  }

  const CALC_TYPE_CHIPS = [
    { label: '999er · 24 Karat' },
    { label: '750er · 18 Karat' },
    { label: '585er · 14 Karat' },
    { label: '333er · 8 Karat' },
    { label: 'Abbrechen' },
  ];

  const DEFAULT_CHIPS = [
    { label: 'Gold Rechner' },
    { label: 'Standort & Kontakt' },
    { label: 'Öffnungszeiten' },
    { label: 'Uhrenreparatur' },
  ];

  /* ── STATE ── */
  let open = false;
  let bState = null; // null | 'calc-type' | 'calc-grams'
  let bData  = {};

  /* ── INTENT ── */
  function intent(raw) {
    const m = raw.toLowerCase();
    const has = (...w) => w.some(x => m.includes(x));
    if (has('gold rechner', 'goldrechner', 'goldwert', 'gold berechnen', 'schätz'))  return 'goldcalc';
    if (has('termin', 'buchen', 'buchung', 'reserv', 'anmeld', 'anfragen'))      return 'visit';
    if (has('öffnungszeit', 'öffnet', 'wann', 'schließt', 'bis wann', 'geöffnet')) return 'hours';
    if (has('adresse', 'wo ', 'standort', 'anfahrt', 'elberfelder', 'hagen', 'kontakt')) return 'location';
    if (has('telefon', 'nummer', 'anruf', 'tel', 'rufnummer', 'anrufen'))         return 'phone';
    if (has('gold', 'silber', 'ring', 'kette', 'armband', 'diamant', 'edelstein')) return 'jewelry';
    if (has('uhr', 'watch', 'reparatur', 'wartung', 'uhren'))                     return 'watch';
    if (has('individual', 'maß', 'anfertig', 'design', 'eigene', 'besonder'))     return 'custom';
    if (has('reinig', 'pflege', 'polier', 'aufarbeitung'))                        return 'cleaning';
    if (has('preis', 'kosten', 'was kostet', 'wie viel'))                         return 'price';
    if (has('danke', 'dankeschön', 'tschüss', 'auf wiedersehen', 'bye'))          return 'bye';
    return 'unknown';
  }

  /* ── RESPONSE BUILDER ── */
  function respond(raw) {
    const trimmed = raw.trim();

    /* cancel out of the calculator */
    if (trimmed === 'Abbrechen') {
      bState = null; bData = {};
      return addBot('Kein Problem! Wie kann ich Ihnen sonst helfen?', DEFAULT_CHIPS);
    }

    /* start the calculator */
    if (bState === null && (trimmed === 'Gold Rechner' || intent(raw) === 'goldcalc')) {
      bState = 'calc-type';
      return addBot('Ich helfe Ihnen gerne beim Schätzen des Goldwerts!<br>Welche Legierung hat Ihr Gold?', CALC_TYPE_CHIPS);
    }

    /* karat step */
    const karatMatch = trimmed.match(/^(999|750|585|333)er/);
    if (bState === 'calc-type' && karatMatch) {
      bData.calcType = karatMatch[1];
      bState = 'calc-grams';
      return addBot(`Gewählt: <strong>${trimmed}</strong>.<br>Wie viele Gramm haben Sie? (z. B. 12.5 oder 8)`, [{ label: 'Abbrechen' }]);
    }
    if (bState === 'calc-type') {
      return addBot('Bitte wählen Sie eine der Legierungen aus.', CALC_TYPE_CHIPS);
    }

    /* grams step -> result */
    if (bState === 'calc-grams') {
      const m = trimmed.replace(',', '.').match(/\d+(\.\d+)?/);
      if (!m) return addBot('Bitte geben Sie ein gültiges Gewicht ein, z. B. 12.5', [{ label: 'Abbrechen' }]);
      const g = parseFloat(m[0]);
      if (g <= 0 || g > 9999) return addBot('Bitte ein realistisches Gewicht eingeben, z. B. 15.', [{ label: 'Abbrechen' }]);
      const pricePerG = GOLD_PER_G[bData.calcType] || 50;
      const estimate = Math.round(g * pricePerG * 0.85);
      const display = m[0].replace('.', ',');
      const type = bData.calcType;
      bState = null; bData = {};
      return addBot(
        `Schätzwert für ${display} g ${type}er Gold:<br><br>💰 ca. <strong>${fmtEUR(estimate)} €</strong><br><br>` +
        `Das ist ein unverbindlicher Richtwert. Den genauen Ankaufspreis bestimmen wir kostenlos direkt im Geschäft.`,
        DEFAULT_CHIPS
      );
    }

    const i = intent(raw);
    switch (i) {
      case 'goldcalc':
        bState = 'calc-type';
        return addBot('Ich helfe Ihnen gerne beim Schätzen des Goldwerts!<br>Welche Legierung hat Ihr Gold?', CALC_TYPE_CHIPS);
      case 'visit':
      case 'location':
        return addBot(
          `Wir freuen uns auf Ihren Besuch – ganz ohne Online-Termin!<br><br>` +
          `📍 <strong>${BIZ.address}</strong><br>` +
          `☎️ <a href="${BIZ.phoneHref}" style="color:${G.gold};font-weight:600;">${BIZ.phone}</a><br><br>` +
          `Mo–Fr 10:00–18:30 Uhr, Sa 10:00–15:00 Uhr. Kommen Sie einfach vorbei!`
        );
      case 'hours':
        return addBot('Wir sind <strong>Mo–Fr 10:00–18:30 Uhr</strong> und <strong>Sa 10:00–15:00 Uhr</strong> für Sie da. Bitte erfragen Sie aktuelle Zeiten direkt telefonisch.');
      case 'phone':
        return addBot(`Rufen Sie uns an: <a href="${BIZ.phoneHref}" style="color:${G.gold};font-weight:600;font-size:16px;">${BIZ.phone}</a>`);
      case 'jewelry':
        return addBot('Wir führen eine exquisite Auswahl an Schmuck in <strong>Gold, Silber und Platin</strong> – mit echten Diamanten und Edelsteinen. Besuchen Sie uns gerne unverbindlich!', [{ label: 'Gold Rechner' }, { label: 'Standort & Kontakt' }]);
      case 'watch':
        return addBot('Unsere <strong>Uhrenreparatur</strong> ist professionell und präzise – für alle Marken und Modelle. Bringen Sie Ihre Uhr einfach vorbei, ganz ohne Termin!', [{ label: 'Standort & Kontakt' }]);
      case 'custom':
        return addBot('Wir fertigen <strong>individuelle Schmuckstücke</strong> nach Ihren Vorstellungen – Ihr Traumschmuck, einzigartig und nach Maß. Kommen Sie gerne für ein Beratungsgespräch vorbei!', [{ label: 'Standort & Kontakt' }]);
      case 'cleaning':
        return addBot('Unsere <strong>professionelle Schmuckreinigung</strong> bringt Ihren Schmuck wieder zum Strahlen – schonend und fachgerecht. Kommen Sie einfach vorbei!');
      case 'price':
        return addBot(`Für genaue Preisinformationen kontaktieren Sie uns bitte direkt unter <a href="${BIZ.phoneHref}" style="color:${G.gold};font-weight:600;">${BIZ.phone}</a>, oder nutzen Sie unseren Gold Rechner für eine erste Einschätzung.`, [{ label: 'Gold Rechner' }]);
      case 'bye':
        return addBot('Auf Wiedersehen! Bei Fragen sind wir jederzeit für Sie da. 💎');
      default:
        return addBot(`Gerne helfe ich weiter! Für persönliche Auskunft erreichen Sie uns unter <a href="${BIZ.phoneHref}" style="color:${G.gold};font-weight:600;">${BIZ.phone}</a>.`, DEFAULT_CHIPS);
    }
  }

  /* ── DOM HELPERS ── */
  function el(tag, css, html) {
    const e = document.createElement(tag);
    if (css) e.setAttribute('style', css);
    if (html !== undefined) e.innerHTML = html;
    return e;
  }

  let msgs;

  function mkAvatar() {
    return el('div',
      `width:30px;height:30px;border-radius:50%;background:${G.gold};flex-shrink:0;` +
      `display:flex;align-items:center;justify-content:center;margin-top:2px;`,
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${G.black}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18"/><path d="m12 3-3 6m3-6 3 6"/></svg>`
    );
  }

  function addBot(text, chips) {
    /* inject typing animation once */
    if (!document.getElementById('sj-cb-anim')) {
      const s = document.createElement('style');
      s.id = 'sj-cb-anim';
      s.textContent = '@keyframes sjDot{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}';
      document.head.appendChild(s);
    }

    /* typing indicator */
    const typingWrap = el('div', `display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;`);
    const dotStyle = `width:7px;height:7px;border-radius:50%;background:${G.muted};display:inline-block;`;
    const tBubble = el('div',
      `background:${G.bgOff};border:1px solid ${G.border};border-radius:4px 14px 14px 14px;` +
      `padding:13px 16px;display:flex;gap:5px;align-items:center;`,
      `<span style="${dotStyle}animation:sjDot 1.2s infinite"></span>` +
      `<span style="${dotStyle}animation:sjDot 1.2s 0.2s infinite"></span>` +
      `<span style="${dotStyle}animation:sjDot 1.2s 0.4s infinite"></span>`
    );
    typingWrap.appendChild(mkAvatar());
    typingWrap.appendChild(tBubble);
    msgs.appendChild(typingWrap);
    msgs.scrollTop = msgs.scrollHeight;

    setTimeout(() => {
      if (typingWrap.parentNode) typingWrap.parentNode.removeChild(typingWrap);

      const wrap = el('div', `display:flex;gap:10px;align-items:flex-start;margin-bottom:14px;opacity:0;transition:opacity 0.4s ease;`);
      const bubble = el('div',
        `background:${G.bgOff};border:1px solid ${G.border};border-radius:4px 14px 14px 14px;` +
        `padding:12px 14px;font-size:14px;line-height:1.65;color:${G.text};max-width:80%;`,
        text.replace(/\n/g, '<br>')
      );
      wrap.appendChild(mkAvatar());
      wrap.appendChild(bubble);
      msgs.appendChild(wrap);
      requestAnimationFrame(() => requestAnimationFrame(() => { wrap.style.opacity = '1'; }));

      if (chips && chips.length) {
        const row = el('div', `display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px;padding-left:40px;opacity:0;transition:opacity 0.4s ease 0.15s;`);
        chips.forEach(c => {
          const btn = el('button',
            `padding:7px 14px;border-radius:20px;border:1px solid ${G.border};` +
            `background:${G.blackMid};font-size:12px;font-weight:500;color:${G.text};` +
            `cursor:pointer;transition:background 180ms,border-color 180ms,color 180ms;font-family:inherit;`,
            c.label
          );
          btn.onmouseenter = () => { btn.style.background = G.goldDim; btn.style.borderColor = G.gold; btn.style.color = G.gold; };
          btn.onmouseleave = () => { btn.style.background = G.blackMid; btn.style.borderColor = G.border; btn.style.color = G.text; };
          btn.onclick = () => { addUser(c.label); respond(c.label); };
          row.appendChild(btn);
        });
        msgs.appendChild(row);
        requestAnimationFrame(() => requestAnimationFrame(() => { row.style.opacity = '1'; }));
      }

      msgs.scrollTop = msgs.scrollHeight;
    }, 1400);
  }

  function addUser(text) {
    const wrap = el('div', `display:flex;justify-content:flex-end;margin-bottom:14px;`);
    const bubble = el('div',
      `background:${G.gold};color:${G.black};border-radius:14px 4px 14px 14px;` +
      `padding:11px 14px;font-size:14px;line-height:1.55;max-width:78%;font-weight:500;`,
      text
    );
    wrap.appendChild(bubble);
    msgs.appendChild(wrap);
    msgs.scrollTop = msgs.scrollHeight;
  }

  /* ── MOBILE RESPONSIVE STYLES ── */
  (function(){
    const s = document.createElement('style');
    s.textContent = `
      @media(max-width:600px){
        #sj-cb-root{bottom:16px !important;right:16px !important;}
        #sj-cb-panel{
          position:fixed !important;
          width:100vw !important;max-width:100vw !important;
          left:0 !important;right:0 !important;bottom:0 !important;
          height:85vh !important;
          height:85dvh !important;
          border-radius:20px 20px 0 0 !important;
          overflow:hidden !important;
        }
        #sj-cb-input-row{
          padding:10px 12px !important;
          padding-bottom:max(10px,env(safe-area-inset-bottom,0px)) !important;
          flex-shrink:0 !important;
        }
        #sj-cb-send{width:44px !important;height:44px !important;}
        #sj-cb-inp{font-size:16px !important;padding:12px 14px !important;}
      }
    `;
    document.head.appendChild(s);
  })();

  /* ── BUILD UI ── */
  const root = el('div',
    `position:fixed;bottom:28px;right:28px;z-index:9999;display:flex;flex-direction:column;align-items:flex-end;`
  );
  root.id = 'sj-cb-root';

  const panel = el('div', null);
  panel.id = 'sj-cb-panel';
  panel.setAttribute('style',
    `width:420px;height:580px;border-radius:16px;overflow:hidden;display:none;` +
    `flex-direction:column;` +
    `box-shadow:0 24px 60px rgba(0,0,0,0.6),0 8px 20px rgba(0,0,0,0.4);` +
    `border:1px solid ${G.border};` +
    `position:absolute;bottom:72px;right:0;`
  );

  /* header */
  const header = el('div',
    `background:${G.black};padding:18px 18px 16px;display:flex;align-items:center;gap:12px;` +
    `border-bottom:1px solid rgba(212,175,55,0.2);`
  );
  const hAvatar = el('div',
    `width:40px;height:40px;border-radius:50%;background:${G.gold};` +
    `display:flex;align-items:center;justify-content:center;flex-shrink:0;`,
    `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="${G.black}" stroke-width="2" stroke-linecap="round"><path d="M6 3h12l3 6-9 12L3 9z"/><path d="M3 9h18"/><path d="m12 3-3 6m3-6 3 6"/></svg>`
  );
  const hInfo = el('div', `flex:1;`);
  const hName = el('div', `font-size:15px;font-weight:600;color:#fff;line-height:1.2;`, 'Sahinler Juwelier');
  const hSub  = el('div', `font-size:11px;color:${G.gold};opacity:0.85;margin-top:2px;`, 'Wir helfen Ihnen gerne');
  const hClose = el('button',
    `background:none;border:none;color:rgba(255,255,255,0.5);font-size:20px;cursor:pointer;` +
    `padding:4px;line-height:1;transition:color 160ms;`,
    '×'
  );
  hClose.onmouseenter = () => { hClose.style.color = '#fff'; };
  hClose.onmouseleave = () => { hClose.style.color = 'rgba(255,255,255,0.5)'; };
  hClose.onclick = () => toggle();
  hInfo.appendChild(hName); hInfo.appendChild(hSub);
  header.appendChild(hAvatar); header.appendChild(hInfo); header.appendChild(hClose);

  /* messages */
  msgs = el('div',
    `flex:1;overflow-y:auto;padding:18px 16px 8px;scroll-behavior:smooth;` +
    `background:${G.bg};scrollbar-width:thin;scrollbar-color:${G.border} transparent;`
  );

  /* input row */
  const inputRow = el('div',
    `display:flex;gap:8px;padding:12px 14px;border-top:1px solid ${G.border};background:${G.black};`
  );
  inputRow.id = 'sj-cb-input-row';
  const inp = el('input', null);
  inp.id = 'sj-cb-inp';
  inp.type = 'text';
  inp.placeholder = 'Ihre Nachricht ...';
  inp.setAttribute('style',
    `flex:1;border:1px solid ${G.border};border-radius:20px;padding:10px 16px;` +
    `font-size:13px;font-family:inherit;color:${G.text};background:${G.blackMid};outline:none;` +
    `transition:border-color 180ms;`
  );
  inp.onfocus = () => { inp.style.borderColor = G.gold; };
  inp.onblur  = () => { inp.style.borderColor = G.border; };

  const sendBtn = el('button',
    `width:38px;height:38px;border-radius:50%;background:${G.gold};border:none;cursor:pointer;` +
    `display:flex;align-items:center;justify-content:center;flex-shrink:0;` +
    `transition:background 160ms,transform 150ms;`,
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="${G.black}" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
  );
  sendBtn.id = 'sj-cb-send';
  sendBtn.onmouseenter = () => { sendBtn.style.background = G.goldLt; sendBtn.style.transform = 'scale(1.08)'; };
  sendBtn.onmouseleave = () => { sendBtn.style.background = G.gold; sendBtn.style.transform = 'scale(1)'; };

  function send() {
    const v = inp.value.trim();
    if (!v) return;
    inp.value = '';
    addUser(v);
    respond(v);
  }
  sendBtn.onclick = send;
  inp.onkeydown = e => { if (e.key === 'Enter') send(); };

  inputRow.appendChild(inp); inputRow.appendChild(sendBtn);
  panel.appendChild(header); panel.appendChild(msgs); panel.appendChild(inputRow);

  /* launcher button */
  const btn = el('div',
    `width:58px;height:58px;border-radius:50%;background:${G.gold};cursor:pointer;` +
    `display:flex;align-items:center;justify-content:center;` +
    `box-shadow:0 6px 24px rgba(212,175,55,0.4),0 2px 8px rgba(0,0,0,0.3);` +
    `transition:transform 200ms,box-shadow 200ms;position:relative;`,
    `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${G.black}" stroke-width="2" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`
  );
  btn.id = 'sj-btn';
  btn.onmouseenter = () => { btn.style.transform = 'scale(1.08)'; btn.style.boxShadow = `0 10px 30px rgba(212,175,55,0.5),0 2px 8px rgba(0,0,0,0.3)`; };
  btn.onmouseleave = () => { btn.style.transform = 'scale(1)'; btn.style.boxShadow = `0 6px 24px rgba(212,175,55,0.4),0 2px 8px rgba(0,0,0,0.3)`; };

  /* notification dot */
  const dot = el('div',
    `position:absolute;top:4px;right:4px;width:10px;height:10px;border-radius:50%;` +
    `background:#e85c5c;border:2px solid #fff;`
  );
  btn.appendChild(dot);

  function toggle() {
    open = !open;
    panel.style.display = open ? 'flex' : 'none';
    dot.style.display = open ? 'none' : 'block';
    btn.style.display = (open && window.innerWidth <= 600) ? 'none' : 'flex';
    if (open && msgs.children.length === 0) {
      addBot(`Hallo! 👋 Willkommen bei <strong>Sahinler Juwelier</strong>.<br>Womit kann ich Ihnen helfen?`, DEFAULT_CHIPS);
    }
    if (open) setTimeout(() => inp.focus(), 120);
  }

  btn.onclick = toggle;
  window.sjCbOpen = () => { if (!open) toggle(); };

  root.appendChild(panel);
  root.appendChild(btn);
  document.body.appendChild(root);
})();
