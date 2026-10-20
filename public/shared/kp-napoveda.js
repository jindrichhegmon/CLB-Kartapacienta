/* Standard aplikací (jako PéčeDoma): 🎨 Vzhled – barevná schémata, 📖 Nápověda – návod s obrázky a 💬 chat nad návodem.
 * Společné pro centrální aplikaci, kartu na mobilu a správu tenantů. Každá aplikace zavolá:
 *   KP.napoveda.nastav({ aplikace: 'centrala' | 'karta' | 'pacient' | 'tenanti', kapitola: 2, auth: () => ({ token, typ }), obrazovka: () => 'Pacienti', fab: true })
 * a do hlavičky vloží KP.tlacitkaHlavicky() – tlačítka obsluhuje jeden delegovaný posluchač, takže přežijí překreslení hlavičky.
 * Návod je Markdown z /api/napoveda (soubor napoveda/napoveda.md), obrázky v /napoveda/img. Chat: POST /api/napoveda/dotaz
 * (jen přihlášený uživatel nebo spárovaný telefon; dotazy jdou přes anonymizační bránu, k datům pacientů chat přístup nemá).
 */
(function () {
  const KP = window.KP;
  const { esc } = KP;

  /* ---------------- Vzhled ---------------- */
  const VZHLEDY = [ // id, název, emoji, popis, [pozadí, hlavní, tmavá]
    ['modra', 'Karta modrá', '💙', 'Výchozí – v noci tmavá podle nastavení systému', ['#f3f5f8', '#1d6fd6', '#124a95']],
    ['zelena', 'PéčeDoma Plus zelená', '🌿', 'Zdravotnická zelená', ['#f1f8f4', '#1f8a5b', '#166b46']],
    ['datec', 'Datec modrá', '🔷', 'Firemní modrá', ['#f2f7fb', '#0060a8', '#004a82']],
    ['vesela', 'Veselá', '🎉', 'Oranžová radost', ['#fdf6f1', '#c9500f', '#9a3c0a']],
    ['konzervativni', 'Konzervativní', '🎩', 'Klidná tmavá zelená', ['#f2f2ee', '#1f4e3d', '#163a2d']],
    ['letni', 'Letní', '🏖️', 'Moře a obloha', ['#f0f8fb', '#007aa6', '#005a7a']],
    ['zimni', 'Zimní', '❄️', 'Mrazivě modrá', ['#f3f5f9', '#2b4c7e', '#1e3760']],
    ['podzimni', 'Podzimní', '🍂', 'Listí a dýně', ['#fbf5ec', '#b5541b', '#8a3f12']],
    ['jarni', 'Jarní', '🌸', 'Rozkvetlé třešně', ['#fbf4f7', '#b8436b', '#8f3051']],
    ['tmava', 'Tmavá', '🌙', 'Tmavé pozadí, světlé písmo', ['#12161d', '#5a9cf0', '#1a1f28']],
  ];
  const vzhledAkt = () => { try { const v = localStorage.getItem('kp_vzhled'); return VZHLEDY.some((x) => x[0] === v) ? v : 'modra'; } catch { return 'modra'; } };
  function vzhledPouzij(id) {
    const r = document.documentElement;
    r.removeAttribute('data-skin'); r.removeAttribute('data-theme');
    if (id === 'tmava') r.setAttribute('data-theme', 'dark');
    else if (id !== 'modra') { r.setAttribute('data-theme', 'light'); r.setAttribute('data-skin', id); }
    const v = VZHLEDY.find((x) => x[0] === id) || VZHLEDY[0];
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', id === 'modra' ? '#1d6fd6' : v[4][1]);
  }
  function vzhledOkno() {
    const akt = vzhledAkt();
    KP.modal(`<h2>🎨 Vzhled</h2><p class="muted" style="margin:0;font-size:13.5px">Barevné schéma platí jen na tomto zařízení a v tomto prohlížeči – ostatním uživatelům se nic nemění. Barvy stavů (červená, oranžová, zelená) zůstávají stejné ve všech schématech.</p>
      <div class="vzhledy">${VZHLEDY.map(([id, nazev, e, popis, [bg, hl, tm]]) => `<button class="vzhled${akt === id ? ' on' : ''}" data-vz="${id}" title="${esc(popis)}">
        <div class="nahled" style="background:${bg}"><div class="h" style="background:${hl}"><i style="width:22px;background:rgba(255,255,255,.85)"></i><i style="width:12px;background:rgba(255,255,255,.5)"></i></div>
          <div class="b"><i style="width:70%;background:${tm}"></i><i style="width:90%;background:${id === 'tmava' ? '#2a313d' : '#fff'}"></i><i style="width:40%;height:9px;background:${hl}"></i></div></div>
        <span class="jm"><span>${e}</span><span>${esc(nazev)}</span></span><span class="ps">${esc(popis)}${akt === id ? ' · ✔ vybráno' : ''}</span></button>`).join('')}</div>
      <div class="quick"><button class="btn" data-close>Hotovo</button></div>`, (m) => {
      m.querySelectorAll('[data-vz]').forEach((b) => (b.onclick = () => { try { localStorage.setItem('kp_vzhled', b.dataset.vz); } catch { /* */ } vzhledPouzij(b.dataset.vz); vzhledOkno(); }));
    });
  }
  KP.vzhled = { seznam: VZHLEDY, aktualni: vzhledAkt, pouzij: vzhledPouzij, okno: vzhledOkno };
  vzhledPouzij(vzhledAkt());

  /* ---------------- Markdown → HTML (nadpisy, odstavce, seznamy, tabulky, citace, obrázky, odkazy, tučné, kód) ---------------- */
  const inline = (t) => esc(t)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/|#)[^)\s]+)\)/g, (_, a, u) => `<a href="${u}"${u.startsWith('http') ? ' target="_blank" rel="noopener"' : ''}>${a}</a>`);
  function md(text) {
    const out = [], kapitoly = []; let seznam = null, odst = [], tabulka = null;
    const zavri = () => {
      if (odst.length) { out.push(`<p>${inline(odst.join(' '))}</p>`); odst = []; }
      if (seznam) { out.push(`<${seznam.typ}>${seznam.polozky.map((p) => `<li>${inline(p)}</li>`).join('')}</${seznam.typ}>`); seznam = null; }
      if (tabulka) { const [h, ...r] = tabulka; out.push(`<table><thead><tr>${h.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${r.map((rr) => `<tr>${rr.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`); tabulka = null; }
    };
    for (const radek of String(text || '').split('\n')) {
      const l = radek.trimEnd();
      let m;
      if (!l.trim()) { zavri(); continue; }
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) {
        zavri(); const u = m[1].length;
        if (u === 2) { const k = m[2].match(/^(\d+)\.\s*(.*)$/); const id = k ? 'kap-' + k[1] : 'kap-' + kapitoly.length; kapitoly.push({ id, cislo: k ? k[1] : '', nazev: m[2] }); out.push(`<h2 id="${id}">${inline(m[2])}</h2>`); }
        else out.push(`<h${u}>${inline(m[2])}</h${u}>`);
        continue;
      }
      if ((m = l.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/))) { zavri(); out.push(`<figure><img src="${esc(m[2])}" alt="${esc(m[1])}" loading="lazy">${m[1] ? `<figcaption>${esc(m[1])}</figcaption>` : ''}</figure>`); continue; }
      if (/^\|.*\|$/.test(l)) { if (odst.length || seznam) zavri(); if (/^\|[\s:|-]+\|$/.test(l)) continue; (tabulka = tabulka || []).push(l.slice(1, -1).split('|').map((c) => c.trim())); continue; }
      if ((m = l.match(/^>\s?(.*)$/))) { zavri(); out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`); continue; }
      if ((m = l.match(/^\s*(?:[-*]|(\d+)\.)\s+(.*)$/))) {
        const typ = m[1] ? 'ol' : 'ul';
        if (odst.length) { out.push(`<p>${inline(odst.join(' '))}</p>`); odst = []; }
        if (!seznam || seznam.typ !== typ) { if (seznam) zavri(); seznam = { typ, polozky: [] }; }
        seznam.polozky.push(m[2]); continue;
      }
      if (seznam && /^\s{2,}\S/.test(radek)) { seznam.polozky[seznam.polozky.length - 1] += ' ' + l.trim(); continue; }
      if (tabulka) zavri();
      odst.push(l.trim());
    }
    zavri();
    return { html: out.join('\n'), kapitoly };
  }

  /* ---------------- Nápověda ---------------- */
  const N = { aplikace: '', kapitola: 1, auth: null, obrazovka: () => '', text: null, chat: [] };
  const KLIC_CHAT = 'kp_napoveda_chat';
  try { N.chat = JSON.parse(sessionStorage.getItem(KLIC_CHAT) || '[]'); if (!Array.isArray(N.chat)) N.chat = []; } catch { N.chat = []; }
  const ulozChat = () => { try { sessionStorage.setItem(KLIC_CHAT, JSON.stringify(N.chat.slice(-30))); } catch { /* */ } };

  async function nactiText() {
    if (N.text) return N.text;
    const r = await fetch('/api/napoveda', { cache: 'no-cache' });
    const d = await r.json().catch(() => ({}));
    if (!r.ok || !d.ok) throw new Error(d.chyba || 'Nápovědu se nepodařilo načíst – zkontrolujte připojení');
    N.text = d.text; return N.text;
  }

  async function otevri(kapitola) {
    let el = document.querySelector('.hlp');
    if (!el) {
      el = document.createElement('div'); el.className = 'hlp';
      el.innerHTML = `<div class="hlp-top"><button class="topikona" data-h="obsah" title="Obsah" aria-label="Obsah">☰</button><h2>📖 Nápověda<span class="hlp-podtitul"> – Karta pacienta</span></h2>
        <button class="btn sm" data-h="chat">💬 Zeptat se</button><button class="topikona" data-kp="vzhled" title="Vzhled – barevné schéma" aria-label="Vzhled">🎨</button><button class="btn sm hlp-tisk" data-h="tisk" title="Vytisknout nebo uložit jako PDF">🖨 Tisk</button><button class="topikona" data-h="zavrit" title="Zavřít" aria-label="Zavřít">✕</button></div>
        <div class="hlp-telo"><nav class="hlp-obsah"></nav><div class="hlp-text"><div class="doc"><p class="muted">Načítám nápovědu…</p></div></div></div>`;
      document.body.appendChild(el);
      el.querySelector('[data-h=zavrit]').onclick = zavri;
      el.querySelector('[data-h=chat]').onclick = () => chat();
      el.querySelector('[data-h=tisk]').onclick = tisk;
      el.querySelector('[data-h=obsah]').onclick = () => el.querySelector('.hlp-obsah').classList.toggle('otevreny');
      el.querySelector('.hlp-text').addEventListener('click', (e) => {
        const img = e.target.closest('figure img'); if (!img) return;
        const z = document.createElement('div'); z.className = 'hlp-zoom'; z.innerHTML = `<img src="${esc(img.src)}" alt="${esc(img.alt)}">`; z.onclick = () => z.remove(); document.body.appendChild(z);
      });
      el.querySelector('.hlp-text').addEventListener('load', () => { if (cil && Date.now() < cil.do && Math.abs(el.querySelector('.hlp-text').scrollTop - cil.pozice) < 4) zarovnej(); }, true);
      document.addEventListener('keydown', esc_);
    }
    try {
      const { html, kapitoly } = md(await nactiText());
      el.querySelector('.doc').innerHTML = html;
      el.querySelector('.hlp-obsah').innerHTML = kapitoly.map((k) => `<a href="#${k.id}" data-k="${k.id}">${esc(k.nazev)}</a>`).join('');
      el.querySelectorAll('.hlp-obsah a').forEach((a) => (a.onclick = (e) => { e.preventDefault(); skoc(a.dataset.k); el.querySelector('.hlp-obsah').classList.remove('otevreny'); }));
      skoc('kap-' + (kapitola || (typeof N.kapitola === 'function' ? N.kapitola() : N.kapitola) || 1));
    } catch (e) { el.querySelector('.doc').innerHTML = `<div class="banner crit">${esc(e.message)}</div>`; }
  }
  // obrázky nad kapitolou se načítají postupně a posouvají text – po každém načteném obrázku se na kapitolu zarovná znovu (do 5 s, dokud uživatel neroluje sám)
  let cil = null;
  function zarovnej() {
    const el = document.querySelector('.hlp'); if (!el || !cil) return;
    const box = el.querySelector('.hlp-text'); const h = el.querySelector('#' + CSS.escape(cil.id));
    if (!h) { box.scrollTop = 0; return; }
    box.scrollTop += h.getBoundingClientRect().top - box.getBoundingClientRect().top - 8;
    cil.pozice = box.scrollTop;
  }
  function skoc(id) {
    const el = document.querySelector('.hlp'); if (!el) return;
    cil = { id, do: Date.now() + 5000 }; zarovnej();
    el.querySelectorAll('.hlp-obsah a').forEach((a) => a.classList.toggle('on', a.dataset.k === id));
  }
  function esc_(e) { if (e.key === 'Escape') { if (document.querySelector('.hlp-zoom')) document.querySelector('.hlp-zoom').remove(); else if (document.querySelector('.hlp-chat')) zavriChat(); else zavri(); } }
  function zavri() { const el = document.querySelector('.hlp'); if (el) el.remove(); document.removeEventListener('keydown', esc_); }
  function tisk() {
    document.body.classList.add('tisk-napovedy');
    const pryc = () => { document.body.classList.remove('tisk-napovedy'); removeEventListener('afterprint', pryc); };
    addEventListener('afterprint', pryc); setTimeout(() => print(), 50);
  }

  /* ---------------- Chat nad návodem ---------------- */
  const NAVRHY = {
    centrala: ['Jak založím nového pacienta?', 'Jak spáruji telefon s kartou?', 'Jak přidám partnera do týmu?', 'Jak předám garanci?'],
    karta: ['Jak zapíšu do deníku?', 'Co dělat při zhoršení stavu?', 'Kde najdu SOS léky?', 'Proč je karta zamčená?'],
    tenanti: ['Jak založím nového tenanta?', 'Jak resetuji heslo správce?'],
    pacient: ['Jak pošlu svá přání lékaři?', 'Jak vytisknu souhrn?', 'Co když zapomenu PIN?', 'Jak nastavím Zdravotní ID?'],
  };
  function chat() {
    let p = document.querySelector('.hlp-chat');
    if (!p) {
      p = document.createElement('div'); p.className = 'hlp-chat';
      p.innerHTML = `<div class="hc-h"><b>💬 Zeptat se nápovědy<small>odpovídá jen podle návodu, data pacientů nevidí</small></b><button data-c="novy" title="Začít znovu">Nový</button><button data-c="zavrit" aria-label="Zavřít">✕</button></div>
        <div class="hc-zpravy"></div><form><textarea placeholder="Napište dotaz k obsluze aplikace…" aria-label="Dotaz"></textarea><button class="btn primary" type="submit">Poslat</button></form>`;
      document.body.appendChild(p);
      p.querySelector('[data-c=zavrit]').onclick = zavriChat;
      p.querySelector('[data-c=novy]').onclick = () => { N.chat = []; ulozChat(); kresliChat(); };
      const ta = p.querySelector('textarea');
      p.querySelector('form').onsubmit = (e) => { e.preventDefault(); posli(ta.value); };
      ta.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); posli(ta.value); } };
    }
    kresliChat();
    setTimeout(() => p.querySelector('textarea').focus(), 50);
  }
  function zavriChat() { const p = document.querySelector('.hlp-chat'); if (p) p.remove(); }
  function kresliChat(ceka) {
    const p = document.querySelector('.hlp-chat'); if (!p) return;
    const box = p.querySelector('.hc-zpravy');
    const zprava = (m) => {
      if (m.role === 'user') return `<div class="hc-m u">${esc(m.text)}</div>`;
      const kap = [];
      const telo = m.text.replace(/^\s*Kapitola:\s*(\d+)\.\s*(.+)$/gm, (_, c, n) => { kap.push([c, n.trim()]); return ''; }).trim();
      return `<div class="hc-m a">${esc(telo)}${kap.map(([c, n]) => `<br><a class="kap" data-kap="${esc(c)}">📖 Kapitola ${esc(c)}. ${esc(n)}</a>`).join('')}</div>`;
    };
    box.innerHTML = (N.chat.length ? '' : `<div class="hc-m a">Dobrý den, poradím s obsluhou Karty pacienta. Odpovídám jen podle návodu – k údajům pacientů přístup nemám, proto do dotazu nepište jména ani rodná čísla.</div>
        <div class="hc-navrhy">${(NAVRHY[N.aplikace] || NAVRHY.centrala).map((t) => `<button type="button">${esc(t)}</button>`).join('')}</div>`)
      + N.chat.map(zprava).join('') + (ceka ? '<div class="hc-m a">Hledám v návodu…</div>' : '');
    box.querySelectorAll('.hc-navrhy button').forEach((b) => (b.onclick = () => posli(b.textContent)));
    box.querySelectorAll('a.kap').forEach((a) => (a.onclick = () => { otevri(a.dataset.kap); if (matchMedia('(max-width:760px)').matches) zavriChat(); }));
    box.scrollTop = box.scrollHeight;
  }
  async function posli(text) {
    const p = document.querySelector('.hlp-chat'); text = String(text || '').trim();
    if (!text || !p || p.dataset.ceka) return;
    p.querySelector('textarea').value = '';
    N.chat.push({ role: 'user', text }); ulozChat();
    p.dataset.ceka = '1'; kresliChat(true);
    try {
      const a = N.auth ? N.auth() : null;
      const r = await KP.api('/api/napoveda/dotaz', { method: 'POST', token: a && a.token, typ: (a && a.typ) || 'Bearer',
        body: { zpravy: N.chat.slice(-12), aplikace: N.aplikace, obrazovka: String(N.obrazovka() || '').slice(0, 120) } });
      N.chat.push({ role: 'assistant', text: r.text || 'Odpověď se nepodařilo sestavit.' });
    } catch (e) {
      N.chat.push({ role: 'assistant', text: e.status === 401 ? 'Chat nápovědy je jen pro přihlášené uživatele a spárované telefony. Návod (📖) je dostupný vždy.' : 'Dotaz se nepodařilo odeslat: ' + e.message });
    }
    delete p.dataset.ceka; ulozChat(); kresliChat();
  }

  function nastav(o) {
    Object.assign(N, o || {});
    if (o && o.fab && !document.querySelector('.hlp-fab')) {
      const b = document.createElement('button'); b.className = 'hlp-fab noprint'; b.innerHTML = '<span class="q">?</span><span class="l">Zeptat se nápovědy</span>';
      b.title = 'Nápověda – zeptejte se na funkce aplikace'; b.onclick = () => chat(); document.body.appendChild(b);
    }
  }
  KP.napoveda = { nastav, otevri, chat, md, zavri };
  // na úzkém telefonu (karta) jen 📖 – Vzhled je pak v okně nápovědy
  KP.tlacitkaHlavicky = ({ vzhled = true } = {}) => '<button class="topikona noprint" data-kp="napoveda" title="Nápověda – návod s obrázky a chat" aria-label="Nápověda">📖</button>'
    + (vzhled ? '<button class="topikona noprint" data-kp="vzhled" title="Vzhled – barevné schéma (pamatuje se na tomto zařízení)" aria-label="Vzhled">🎨</button>' : '');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-kp]'); if (!b) return;
    if (b.dataset.kp === 'napoveda') otevri();
    else if (b.dataset.kp === 'vzhled') vzhledOkno();
  });
})();
