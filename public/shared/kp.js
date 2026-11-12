/* Společné funkce pro centrální aplikaci, kartu na mobilu a správu tenantů. */
(function () {
  const KP = {};
  // 0.11.108: stránka vložená v rámu (centrála nebo /pd/ v okně portálu PéčeDoma) – iPhone hlásí i v rámu výřez displeje
  // (env(safe-area-inset-top) ≈ 59 px), přilepená hlavička pak visela o kus níž přes obsah; v rámu se odsazení výřezu neuplatní (kp.css html.vramu)
  try { KP.vRamu = window.self !== window.top; } catch (e) { KP.vRamu = true; }
  if (KP.vRamu) document.documentElement.classList.add('vramu');
  KP.CILE = { symptom: 'Symptomatická (úleva od obtíží)', limited: 'Omezená (léčba bez resuscitace a intenzivní péče)', full: 'Plná léčba' };
  KP.LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];
  KP.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  KP.fmtD = (iso) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${+d}. ${+m}. ${y}`; };
  KP.fmtDT = (s) => { if (!s) return '—'; const t = String(s).replace('T', ' '); return `${KP.fmtD(t.slice(0, 10))} ${t.slice(11, 16)}`; };
  KP.dnes = () => new Date().toISOString().slice(0, 10);
  KP.prosly = (iso) => !!iso && iso < KP.dnes();
  KP.casLokalni = (posunDni = 0) => { const d = new Date(); if (posunDni) d.setDate(d.getDate() + posunDni); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  KP.uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15); return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  KP.toast = (m) => { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 3200); };
  KP.modal = (html, bind) => {
    let m = document.getElementById('modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
    // 0.11.44: každé okno má vpravo nahoře křížek (data-close) – zavře ho stejně jako klepnutí mimo okno
    m.innerHTML = `<div class="modal"><div class="box"><div class="grab"></div><button type="button" class="mzav" data-close aria-label="Zavřít" title="Zavřít">×</button>${html}</div></div>`;
    m.querySelector('.modal').onclick = (e) => { if (e.target.classList.contains('modal')) KP.closeModal(); };
    m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = KP.closeModal));
    if (bind) bind(m);
  };
  /* 0.11.56: výzva k přijetí videohovoru – okno uprostřed obrazovky (nad vším, i nad zámkem); stejné pro kartu týmu i Můj průkaz */
  KP.vyzvaHovoru = ({ id, jmeno, popis, prijmout, odmitnout }) => {
    let el = document.getElementById('vidvyzva');
    if (el && el.dataset.id === String(id)) return;
    if (el) el.remove();
    el = document.createElement('div'); el.id = 'vidvyzva'; el.className = 'vidvyzva'; el.dataset.id = String(id);
    el.innerHTML = `<div class="vidvyzva-box" role="dialog" aria-modal="true"><div class="vidvyzva-ikona">${KP.ICON.video}</div><h2>Příchozí videohovor</h2>
      <div class="vidvyzva-kdo">${KP.esc(jmeno)}</div><div class="vidvyzva-popis">${KP.esc(popis || '')}</div>
      <button type="button" class="btn primary block" id="vidPrijmout">Přijmout</button><button type="button" class="btn block" id="vidOdmitnout">Odmítnout</button></div>`;
    document.body.appendChild(el);
    el.querySelector('#vidPrijmout').onclick = () => { KP.zavriVyzvu(); prijmout(); };
    el.querySelector('#vidOdmitnout').onclick = () => { KP.zavriVyzvu(); odmitnout(); };
  };
  KP.zavriVyzvu = () => { const el = document.getElementById('vidvyzva'); if (el) el.remove(); };
  /* 0.11.57: okno hovoru přes Jitsi External API – aplikace se dozví, když se hovor zavěsí tlačítkem uvnitř Jitsi (červené sluchátko),
     a ukončí ho i u sebe a na serveru (dřív okno zůstalo viset a server hovor dál vedl jako probíhající, další volání pak nezvonilo).
     Když se external_api.js z serveru videohovorů nenačte (bez sítě), použije se obyčejný iframe jako dřív. */
  KP.jitsiOkno = (odkaz, parent, { naKonec } = {}) => {
    const stav = { api: null, iframe: null, hotovo: false, zavri() { if (this.api) { try { this.api.dispose(); } catch { /* */ } this.api = null; } if (this.iframe) { this.iframe.remove(); this.iframe = null; } } };
    const konec = () => { if (stav.hotovo) return; stav.hotovo = true; if (naKonec) naKonec(); };
    let u; try { u = new URL(odkaz); } catch { return stav; }
    const roomName = u.pathname.replace(/^\/+/, '');
    const cfg = {}; let displayName = '';
    for (const part of u.hash.replace(/^#/, '').split('&')) {
      const i = part.indexOf('='); if (i < 0) continue;
      const k = part.slice(0, i); let v = part.slice(i + 1); try { v = decodeURIComponent(v); } catch { /* */ }
      if (k === 'userInfo.displayName') { try { displayName = JSON.parse(v); } catch { displayName = v; } }
      else if (k.startsWith('config.')) cfg[k.slice(7)] = v === 'true' ? true : v === 'false' ? false : v;
    }
    const nahradni = () => {
      if (stav.api || stav.iframe) return;
      const f = document.createElement('iframe'); f.src = odkaz; f.allow = 'camera; microphone; autoplay; display-capture; fullscreen'; f.allowFullscreen = true; f.title = 'Videohovor';
      parent.appendChild(f); stav.iframe = f;
    };
    const spust = () => {
      try {
        // 0.11.61: bez nadpisu s názvem místnosti; média vždy přes server (JVB) – přímé spojení P2P mezi dvěma účastníky se na některých telefonech nenaváže pro zvuk
        stav.api = new window.JitsiMeetExternalAPI(u.host, { roomName, parentNode: parent, width: '100%', height: '100%', userInfo: displayName ? { displayName } : undefined,
          configOverwrite: { ...cfg, hideConferenceSubject: true, p2p: { enabled: false } } });
        stav.api.addListener('readyToClose', konec);
        stav.api.addListener('videoConferenceLeft', konec);
      } catch { nahradni(); }
    };
    if (!/^https?:$/.test(u.protocol)) nahradni();
    else if (window.JitsiMeetExternalAPI) spust();
    else { const s = document.createElement('script'); s.src = `${u.origin}/external_api.js`; s.onload = spust; s.onerror = nahradni; document.head.appendChild(s); }
    return stav;
  };
  KP.closeModal = () => {
    const m = document.getElementById('modal'); if (!m) return;
    // běžící fotoaparát (čtení QR) při zavření vypnout, ať nesvítí dál
    m.querySelectorAll('video').forEach((v) => { try { if (v.srcObject) { v.srcObject.getTracks().forEach((t) => t.stop()); v.srcObject = null; } } catch { /* */ } });
    m.innerHTML = '';
  };
  KP.confirm = (titulek, text, ok = 'Potvrdit', crit = false) => new Promise((res) => {
    KP.modal(`<h2>${KP.esc(titulek)}</h2><p>${text}</p><div class="quick"><button class="btn ${crit ? 'crit' : 'primary'}" id="kpOk">${KP.esc(ok)}</button><button class="btn" data-close>Zpět</button></div>`,
      (m) => { m.querySelector('#kpOk').onclick = () => { KP.closeModal(); res(true); }; m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => { KP.closeModal(); res(false); })); });
  });

  /** JSON API s Bearer session. */
  KP.api = async (path, { method = 'GET', body, token, typ = 'Bearer' } = {}) => {
    const r = await fetch(path, {
      method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `${typ} ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let d = {}; try { d = await r.json(); } catch { d = { ok: false, chyba: `Server odpověděl ${r.status}` }; }
    if (!r.ok || d.ok === false) { const e = new Error(d.chyba || `Chyba ${r.status}`); e.status = r.status; throw e; }
    return d;
  };

  KP.ICON = {
    tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/></svg>',
    zpravy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1.1-4.3A8 8 0 1 1 21 12z"/></svg>',
    odpac: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>',
    karta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="3"/></svg>',
    denik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h12a3 3 0 013 3v11H7a3 3 0 00-3 3z"/><path d="M8 9h7M8 13h7"/></svg>',
    dg: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3v6a6 6 0 0012 0V3"/><path d="M12 15v3a3 3 0 006 0v-2"/><circle cx="18" cy="14" r="2"/></svg>',
    leky: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-45 12 12.5)"/><path d="M8.5 16L15.5 9"/></svg>',
    zhorseni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 17H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    kontakty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    udaje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
    dok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg>',
    zamek: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
    sync: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/></svg>',
  };

  /** Telefonní číslo jako tlačítko na samostatném řádku: rámeček, ikona sluchátka, klepnutím se volá (0.11.41). `popis` = drobný text vpravo. */
  KP.telHTML = (tel, { popis = '' } = {}) => {
    const t = String(tel || '').trim(); if (!t) return '';
    return `<a class="telbtn" href="tel:${KP.esc(t.replace(/[^+\d]/g, ''))}" aria-label="Zavolat ${KP.esc(t)}">${KP.ICON.tel}<span class="telc">${KP.esc(t)}</span>${popis ? `<span class="telp">${KP.esc(popis)}</span>` : ''}</a>`;
  };

  /** Systémové tlačítko Zpět (Android) aplikaci neukončí: drží v historii jeden krok navíc a při každém Zpět zavolá `fn`
   *  (zavřít okno, vrátit se na úvodní dlaždici) a krok zase doplní. Ukončit aplikaci jde jen tlačítkem Domů (0.11.43). */
  KP.zachytZpet = (fn) => {
    try { history.pushState({ kp: 'zpet' }, ''); } catch { return; }
    addEventListener('popstate', () => { try { fn(); } catch { /* */ } try { history.pushState({ kp: 'zpet' }, ''); } catch { /* */ } });
  };

  /** Aktivní zhoršení = poslední krizový zápis je „Zhoršení stavu“. */
  KP.aktivniZhorseni = (denik) => {
    const krize = (denik || []).filter((e) => ['Zhoršení stavu', 'Stav stabilizován', 'Výjezd ZZS', 'Ukončení'].includes(e.typ));
    const l = krize[krize.length - 1];
    return l && l.typ === 'Zhoršení stavu' ? l : null;
  };


  /* formulář plánu péče (0.11.65 sdílený: centrála i Karta pacienta uvnitř PéčeDoma /pd/) */
  KP.planForm = (data, platnost, ro, pref = 'f', { leky = false } = {}) => {
    const e = KP.esc;
    data = data || {}; const dk = data.doklad || {};
    // 0.11.92: limitace péče = jedna ze dvou možností podle toho, zda má pacient podepsané dříve vyslovené přání (DVP)
    const kpr = data.kpr || (dk.dvp ? 'dvp' : 'neuvedeno');
    return `<div class="form ${ro ? 'locked' : ''}">
    <div class="field"><label>Cíl péče</label><select id="${pref}_cil">${Object.entries(KP.CILE).map(([k, v]) => `<option value="${k}" ${data.cil === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    <div class="field"><label>Limitace péče</label><div class="kpr-volba">
      <label class="kpr-moz"><input type="radio" name="${pref}_kpr" value="neuvedeno" ${kpr === 'neuvedeno' ? 'checked' : ''}><span><b>KPR neuvedeno</b><span class="lbl">pacient nemá podepsané dříve vyslovené přání</span></span></label>
      <label class="kpr-moz"><input type="radio" name="${pref}_kpr" value="dvp" ${kpr === 'dvp' ? 'checked' : ''}><span><b>Dříve vyslovené přání</b> (living will)<span class="lbl">pacient má podepsané DVP – vyberte, co si nepřeje</span></span></label></div>
      ${!data.kpr && (data.limity || []).length ? `<span class="hint">Dosavadní plán (bez této volby): ${e((data.limity || []).join(', '))}${dk.dvp ? ' – s DVP' : ' – rozhodnutí lékaře'}. Uložením se použije zvolená možnost.</span>` : ''}</div>
    <div id="${pref}_dvpsek" ${kpr === 'dvp' ? '' : 'hidden'}>
    <div class="field"><label>Pacient si nepřeje (podle DVP)</label><div class="checks">${KP.LIMITY.map((l) => `<label><input type="checkbox" name="${pref}_lim" value="${e(l)}" ${(data.limity || []).includes(l) ? 'checked' : ''}>${e(l)}</label>`).join('')}</div></div>
    <div class="frow"><div class="field"><label>Datum DVP</label><input type="date" id="${pref}_dvpd" value="${e(dk.datum || '')}"></div><div class="field"><label>Kde je originál DVP</label><input id="${pref}_orig" value="${e(dk.original || '')}"></div></div>
    <div class="frow"><div class="field"><label>Písemné poučení lékařem</label><select id="${pref}_pou"><option value="1" ${dk.pouceni ? 'selected' : ''}>ano, je přiloženo</option><option value="0" ${!dk.pouceni ? 'selected' : ''}>neuvedeno</option></select></div><div class="field"><label>Podpis pacienta</label><select id="${pref}_ovp"><option value="1" ${dk.overenyPodpis ? 'selected' : ''}>úředně ověřený</option><option value="0" ${!dk.overenyPodpis ? 'selected' : ''}>neuvedeno</option></select></div></div>
    <div class="field"><label>DVP sepsané při přijetí u poskytovatele</label><input id="${pref}_prij" value="${e(dk.prijeti || '')}" placeholder="jen pokud bylo sepsáno při přijetí do péče nebo hospitalizaci – např. Nemocnice Zlín, interna"><span class="hint">Takové přání platí jen u tohoto poskytovatele – karta pro ZZS to tak i ukáže.</span></div>
    <div class="note">Aplikace jen eviduje, jaký doklad existuje a kde je originál. Vyplnění zde ani v aplikaci pacienta dříve vyslovené přání nevytváří (§ 36 zákona o zdravotních službách: písemné poučení lékařem a úředně ověřený podpis, nebo zápis při přijetí do péče).</div>
    </div>
    <input type="hidden" id="${pref}_zpr" value="${e(dk.zprava || '')}">
    <div class="field"><label>Diagnózy</label><textarea id="${pref}_dg" style="font-family:var(--font);min-height:60px">${e(data.dg || '')}</textarea>
      ${ro ? '' : `<div class="dg-hledat"><input id="${pref}_dgq" placeholder="Přidat diagnózu z číselníku – kód (C50) nebo název" autocomplete="off"><div id="${pref}_dgn" class="dg-nab" hidden></div></div><span class="hint">Ke kódům diagnóz se na kartě doplní popis z číselníku (např. C50 – Zhoubný novotvar prsu).</span>`}</div>
    <div class="field"><label>Obvyklý funkční stav</label><textarea id="${pref}_fun" style="font-family:var(--font);min-height:60px">${e(data.funkce || '')}</textarea></div>
    <div class="frow"><div class="field"><label>Alergie</label><input id="${pref}_al" value="${e(data.alergie || '')}"></div><div class="field"><label>Platnost plánu do</label><input type="date" id="${pref}_plat" value="${e(platnost || '')}"></div></div>
    ${leky ? `<div class="field"><label>Opioidy (řádek = lék)</label><textarea id="${pref}_opi" style="font-family:var(--font);min-height:60px">${e((data.opioidy || []).join('\n'))}</textarea></div>
    <div class="field"><label>SOS medikace (řádek = lék)</label><textarea id="${pref}_sos" style="font-family:var(--font);min-height:80px">${e((data.sos || []).join('\n'))}</textarea></div>
    <div class="field"><label>Paliativní terapie (řádek = lék)</label><textarea id="${pref}_med" style="font-family:var(--font);min-height:90px">${e((data.medikace || []).join('\n'))}</textarea><span class="hint">Chronická terapie se nezadává.</span></div>` : ''}
    <label class="row" style="gap:8px"><input type="checkbox" id="${pref}_ter" ${data.terapieNaKarte ? 'checked' : ''}> Na krizové kartě ukazovat i <b>paliativní terapii</b> (jinak jen opioidy a SOS medikaci)</label>
  </div>`;
  };
  KP.ctiPlan = (pref = 'f', base = {}) => {
    const $ = (id) => document.getElementById(id);
    const v = (id) => ($(`${pref}_${id}`) || {}).value || '';
    const radky = (id, puvodni) => ($(`${pref}_${id}`) ? v(id).split('\n').map((x) => x.trim()).filter(Boolean) : (puvodni || []));
    const kprEl = document.querySelector(`input[name=${pref}_kpr]:checked`);
    const kpr = kprEl ? kprEl.value : (base.kpr || 'neuvedeno');
    const dvp = kpr === 'dvp';
    return { data: { cil: v('cil'), kpr, limity: dvp ? [...document.querySelectorAll(`input[name=${pref}_lim]:checked`)].map((i) => i.value) : [],
      doklad: { dvp, datum: dvp ? v('dvpd') : '', original: dvp ? v('orig') : '', zprava: v('zpr'), pouceni: dvp && v('pou') === '1', overenyPodpis: dvp && v('ovp') === '1', prijeti: dvp ? v('prij').trim() : '' },
      dg: v('dg'), funkce: v('fun'), alergie: v('al'), sos: radky('sos', base.sos), opioidy: radky('opi', base.opioidy), medikace: radky('med', base.medikace),
      terapieNaKarte: $(`${pref}_ter`) ? $(`${pref}_ter`).checked : !!base.terapieNaKarte }, platnostDo: v('plat') };
  };
  /* 0.11.92: oživení formuláře plánu – přepínání DVP části a našeptávač diagnóz (hledat(q) → Promise<{diagnozy}>) */
  KP.bindPlanForm = (pref = 'f', { hledatDg } = {}) => {
    const $ = (id) => document.getElementById(id);
    const sek = $(`${pref}_dvpsek`);
    document.querySelectorAll(`input[name=${pref}_kpr]`).forEach((r) => r.addEventListener('change', () => { if (sek) sek.hidden = r.value !== 'dvp' || !r.checked; }));
    if (hledatDg) KP.dgNaseptavac($(`${pref}_dgq`), $(`${pref}_dgn`), $(`${pref}_dg`), hledatDg);
  };
  KP.dgNaseptavac = (vstup, nabidka, cil, hledatDg) => {
    if (!vstup || !nabidka || !cil) return;
    let casovac = null, posledni = '';
    const zavri = () => { nabidka.hidden = true; nabidka.innerHTML = ''; };
    vstup.addEventListener('input', () => {
      clearTimeout(casovac); const t = vstup.value.trim();
      if (t.length < 2) return zavri();
      casovac = setTimeout(async () => {
        posledni = t;
        try {
          const r = await hledatDg(t); if (posledni !== t) return;
          const dg = r.diagnozy || [];
          nabidka.innerHTML = dg.length ? dg.map((d) => `<button type="button" data-dgk="${KP.esc(d.kod)}" data-dgp="${KP.esc(d.popis)}"><b>${KP.esc(d.kod)}</b> ${KP.esc(d.popis)}</button>`).join('') : '<div class="muted">nic nenalezeno</div>';
          nabidka.hidden = false;
          nabidka.querySelectorAll('[data-dgk]').forEach((b) => (b.onclick = () => {
            const radek = `${b.dataset.dgk} ${b.dataset.dgp}`;
            cil.value = cil.value.trim() ? cil.value.replace(/\s+$/, '') + '\n' + radek : radek;
            cil.dispatchEvent(new Event('input', { bubbles: true }));
            vstup.value = ''; zavri(); vstup.focus();
          }));
        } catch (e) { nabidka.innerHTML = `<div class="muted">${KP.esc(e.message)}</div>`; nabidka.hidden = false; }
      }, 250);
    });
    vstup.addEventListener('keydown', (e) => { if (e.key === 'Escape') { vstup.value = ''; zavri(); } });
  };
  /* 0.11.92: popisy kódů diagnóz z číselníku – jen ty, jejichž popis už v textu není */
  KP.dgPopisRadky = (text, popisy) => {
    const t = String(text || ''), maly = t.toLowerCase(), out = [];
    for (const k of new Set((t.toUpperCase().match(/\b[A-TV-Z]\d{2}(?:\.?\d{1,2})?\b/g) || []))) {
      const p = (popisy || {})[k.replace('.', '')];
      if (p && !maly.includes(p.toLowerCase())) out.push({ kod: k, popis: p });
    }
    return out;
  };
  /** Krizová karta z balíku (stejný tvar posílá server telefonu i centrální aplikaci). */
  /* doklad k limitacím (§ 36): DVP s poučením a ověřeným podpisem, DVP z přijetí (platí jen u toho poskytovatele), nebo rozhodnutí lékaře */
  KP.dokladHTML = (d) => {
    d = d || {};
    if (!d.dvp) return '<span class="chip warn">bez dříve vysloveného přání</span> rozhodnutí lékaře';
    const zaklad = `dříve vyslovené přání${d.datum ? ' z ' + KP.fmtD(d.datum) : ''}`;
    if (d.prijeti) return `${zaklad}, sepsané při přijetí u ${KP.esc(d.prijeti)} <span class="chip warn">platí jen u tohoto poskytovatele</span>`;
    if (d.pouceni && d.overenyPodpis) return `${zaklad} <span class="chip ok">poučení lékařem a ověřený podpis</span>`;
    return `${zaklad} <span class="chip warn">poučení / ověření podpisu neuvedeno – ověřte u originálu</span>`;
  };
  /* chat PéčeDoma s klientem (od 0.8.0) – jedno okno pro centrálu, telefon i Můj průkaz.
     nacti() → { zpravy }, posli(text) → { zpravy }; mojeSmer = 'OD_TYMU' (centrála) nebo 'OD_PACIENTA' (telefony) */
  KP.chatHTML = (zpravy, mojeSmer, nazvy = {}) => (zpravy || []).length
    ? zpravy.map((z) => `<div class="msg ${z.smer === mojeSmer ? 'out' : 'in'} ${z.smer === 'OD_TYMU' ? 'tym' : 'klient'}${z.sms ? ' sms' : ''}"><div class="who">${KP.esc(nazvy[z.smer] || (z.smer === 'OD_TYMU' ? 'Tým PéčeDoma' : 'Klient'))}${z.kdo ? ' · ' + KP.esc(z.kdo) : ''} · ${KP.esc(KP.fmtDT(z.cas))}${z.sms ? ' · SMS' : ''}</div>${KP.esc(z.text)}</div>`).join('')
    : '<div class="muted" style="font-size:13px">Zatím žádné zprávy – napište první.</div>';
  /* náhled posledních zpráv bez rozklikávání (od 0.8.4): n posledních zpráv, prázdné vlákno = krátký text */
  KP.chatNahled = (zpravy, mojeSmer, nazvy = {}, n = 2) => (zpravy || []).length
    ? `<div class="chatl" style="max-height:none;min-height:0;padding:0 0 4px">${KP.chatHTML(zpravy.slice(-n), mojeSmer, nazvy)}</div>`
    : '<div class="muted" style="font-size:13px;padding:0 0 6px">Zatím žádné zprávy.</div>';
  KP.chatOkno = ({ titulek = 'Chat PéčeDoma', popis = '', mojeSmer, nazvy = {}, nacti, posli, poZmene = null }) => {
    KP.modal(`<h2>${KP.esc(titulek)}</h2>${popis ? `<div class="muted" style="font-size:13px">${popis}</div>` : ''}<div id="chat_l" class="chatl"><div class="muted" style="font-size:13px">Načítám zprávy…</div></div>
      <div class="row" style="gap:8px"><input id="chat_t" placeholder="Napište zprávu…" style="flex:1" maxlength="4000" autocomplete="off"><button class="btn primary" id="chat_s">Odeslat</button></div>
      <div class="quick"><button class="btn" data-close>Zavřít</button></div>`, (m) => {
      const l = m.querySelector('#chat_l'), t = m.querySelector('#chat_t'), s = m.querySelector('#chat_s');
      const ukaz = (zpravy) => { l.innerHTML = KP.chatHTML(zpravy, mojeSmer, nazvy); l.scrollTop = l.scrollHeight; if (poZmene) { try { poZmene(zpravy); } catch { /* */ } } };
      const chybaUkaz = (e) => { l.innerHTML = `<div class="banner crit">${KP.esc(e.message || String(e))}</div>`; };
      nacti().then((r) => ukaz(r.zpravy)).catch(chybaUkaz);
      const odesli = async () => { const text = t.value.trim(); if (!text) return; s.disabled = true; try { const r = await posli(text); t.value = ''; ukaz(r.zpravy); KP.toast('Zpráva odeslána do PéčeDoma'); } catch (e) { KP.toast(e.message); } s.disabled = false; t.focus(); };
      s.onclick = odesli; t.onkeydown = (e) => { if (e.key === 'Enter') odesli(); };
      setTimeout(() => t.focus(), 50);
    });
  };
  /* Vysvětlivky na klik (od 0.8.3): vysvětlující texty (.note, .rolehelp bez třídy keep) se po vykreslení přesunou na konec
     obrazovky do sbaleného bloku „Vysvětlivky“, aby obrazovka ukazovala jen důležité informace. Prázdný obal (panel) se odstraní. */
  KP.sbalVysvetlivky = (root, { pred = null, titulek = 'Vysvětlivky' } = {}) => {
    if (!root) return;
    const els = [...root.querySelectorAll('.note:not(.keep), .rolehelp:not(.keep)')].filter((e) => !e.closest('.vysv') && !e.closest('#modal') && e.textContent.trim());
    if (!els.length) return;
    const d = document.createElement('details'); d.className = 'vysv';
    d.innerHTML = `<summary>${KP.esc(titulek)} <span class="chip">${els.length}</span></summary><div class="vysv-b"></div>`;
    const b = d.querySelector('.vysv-b');
    els.forEach((e) => { const par = e.parentElement; e.classList.remove('rolehelp'); e.classList.add('note'); e.style.margin = ''; b.appendChild(e);
      if (par && par !== root && !par.children.length && !par.textContent.trim()) par.remove(); });
    const kam = pred ? root.querySelector(pred) : null;
    if (kam) root.insertBefore(d, kam); else root.appendChild(d);
  };
  /* Léky – jeden zdroj (od 0.9.0): u pacienta propojeného s PéčeDoma jsou léky z PéčeDoma (a tam se i mění), jinak z plánu péče */
  KP.leky = (b) => {
    const pd = b && b.pecedoma, p = (b && b.plan && b.plan.data) || {};
    if (pd && pd.propojeno && pd.aktualizovano) return { sos: pd.sos || [], opioidy: pd.opioidy || [], medikace: pd.medikace || [], zdroj: 'pecedoma', aktualizovano: pd.aktualizovano };
    return { sos: p.sos || [], opioidy: p.opioidy || [], medikace: p.medikace || [], zdroj: pd && pd.propojeno ? 'pecedoma-ceka' : 'plan' };
  };
  /* Léky z PéčeDoma – seznam s tlačítky a okno pro přidání / úpravu (centrála i telefon lékaře) */
  KP.TYP_LEKU = { ZACHRANNA: 'SOS lék', OPIOID: 'opioid', PRAVIDELNA: 'paliativní terapie', PARENTERALNI: 'parenterálně' };
  KP.SKUPINY_LEKU = [['ZACHRANNA', 'SOS léky', 'warn'], ['OPIOID', 'Opioidy', 'crit'], ['PRAVIDELNA', 'Paliativní terapie', 'acc'], ['PARENTERALNI', 'Parenterálně', 'vio']];
  KP.lekyRadky = (leky, muze) => {
    const e = KP.esc, sk = KP.SKUPINY_LEKU;
    // každá skupina jako samostatný barevně odlišený blok (od 0.9.5): barevný pruh vlevo, podbarvené záhlaví, počet léků
    return sk.map(([t, n, c]) => { const r = (leky || []).filter((l) => l.typ === t); return `<section class="lkskup ${c}${r.length ? '' : ' prazdna'}">
      <div class="lkskup-h"><span>${n}</span><span class="chip ${c}">${r.length}</span></div>
      ${r.length ? `<table class="tbl"><tbody>${r.map((l) => `<tr><td><b>${e(l.nazev)}</b>${l.davka ? ' – ' + e(l.davka) : ''}${l.instr ? `<div class="lbl">${e(l.instr)}</div>` : ''}${l.popis ? `<div class="lbl">pro pacienta: ${e(l.popis)}</div>` : ''}</td>
        <td style="white-space:nowrap;text-align:right">${muze ? `<button class="btn sm" data-lk-edit="${e(l.id)}">Upravit</button> <button class="btn sm" data-lk-del="${e(l.id)}">Vyřadit</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="muted lkskup-p">žádné</div>'}</section>`; }).join('');
  };
  KP.lekOkno = (l, ulozit) => {
    const e = KP.esc, $ = (id) => document.getElementById(id);
    KP.modal(`<h2>${l ? 'Upravit lék' : 'Přidat lék'}</h2><div class="form">
      <div class="field"><label>Typ</label><select id="lk_t">${Object.entries(KP.TYP_LEKU).map(([k, n]) => `<option value="${k}" ${l ? (l.typ === k ? 'selected' : '') : (k === 'PRAVIDELNA' ? 'selected' : '')}>${n}</option>`).join('')}</select></div>
      <div class="field"><label>Název léku *</label><input id="lk_n" value="${e(l ? l.nazev : '')}" placeholder="např. Morphin 10 mg"></div>
      <div class="field"><label>Dávkování</label><input id="lk_d" value="${e(l ? l.davka : '')}" placeholder="např. 1-0-1, nebo 10 mg s.c."></div>
      <div class="field"><label>Instrukce (u SOS léku: kdy podat, nejvýš jak často)</label><input id="lk_i" value="${e(l ? l.instr : '')}" placeholder="např. při bolesti nebo dušnosti, nejvýš po 4 h"></div>
      <div class="field"><label>Popis pro pacienta (volitelně)</label><input id="lk_p" value="${e(l ? l.popis : '')}"></div>
      <div class="quick"><button class="btn primary ulozit" id="lk_save">Uložit</button><button class="btn" data-close>Zrušit</button></div></div>`, () => {
      $('lk_save').onclick = async () => {
        const b = { id: l ? l.id : undefined, nazev_puv: l ? l.nazev : '', typ: $('lk_t').value, nazev: $('lk_n').value.trim(), davka: $('lk_d').value.trim(), instr: $('lk_i').value.trim(), popis: $('lk_p').value.trim() };
        if (!b.nazev) return KP.toast('Vyplňte název léku');
        $('lk_save').disabled = true;
        try { await ulozit(b); KP.closeModal(); } catch (err) { KP.toast(err.message); $('lk_save').disabled = false; }
      };
    });
  };
  KP.kartaHTML = (b, { tlacitka = '', navsteva = true } = {}) => {
    const p = b.pacient || {}; const plan = (b.plan && b.plan.data) || {}; const platnost = b.plan && b.plan.platnostDo;
    const kontakty = (b.kontakty || []).map((k) => ({ ...k, skupina: String(k.skupina || '').toLowerCase() }));
    const g = b.garant || {};
    const first = kontakty.find((k) => /hospic/i.test(k.jmeno) && k.skupina === 'pecuje') || kontakty.find((k) => k.skupina === 'pecuje') || (g.telefon24 ? { jmeno: g.poskytovatel, tel: g.telefon24 } : null);
    // od 0.10.1 v kartě všechny důležité kontakty v pořadí ze záložky (rozhoduje první), ne jen skupina „rozhoduje“ – rodina (informovat) byla v kartě neviditelná
    const SKUP_NAZ = { rozhoduje: 'Rozhoduje', informovat: 'Informovat', pecuje: 'Pečuje' };
    const dalsiKontakty = [...kontakty.filter((k) => k.skupina === 'rozhoduje'), ...kontakty.filter((k) => k.skupina !== 'rozhoduje')].filter((k) => k !== first);
    const limity = plan.limity || []; const kpr = limity.includes('KPR');
    const dalsi = limity.filter((l) => l !== 'KPR');
    const doklad = plan.doklad || {};
    const zh = KP.aktivniZhorseni(b.denik);
    const last = zh || (b.denik || []).filter((e) => !KP.SYSTEM_TYPY.includes(e.typ)).slice(-1)[0];
    const exp = !b.plan || KP.prosly(platnost);
    // 0.11.87: odborný zástupce pracoviště garanta (Správa organizace → Pracoviště); bez něj jako dřív lékař, který plán uložil
    const lekarJm = g.odbornyZastupce || (b.plan && b.plan.podepsal) || g.lekar || '—';
    const lekarTel = g.telefon24 || '';   // 0.11.64: vždy hlavní číslo organizace (telefon 24/7); osobní číslo lékaře na kartu nikdy nejde
    const pd = b.pecedoma || null;   // propojení s PéčeDoma: nejbližší plánovaná návštěva (`navsteva`) – jen po odemknutí lékařem / členem týmu a v centrále; zamčená karta (ZZS), rodina a Můj průkaz ji nevidí (0.11.40)
    const leky = KP.leky(b);
    const e = KP.esc;
    return `<div class="card">
      <div class="hdr"><div class="row" style="justify-content:space-between"><span>KRIZOVÝ PLÁN PÉČE · ${e(p.kod || '')}</span><span class="valid ${exp ? 'exp' : ''}">${!b.plan ? 'BEZ PLÁNU' : exp ? 'ČEKÁ NA REVIZI' : 'platí do ' + KP.fmtD(platnost)}</span></div>
        <div class="name">${e(p.prijmeni || '')} ${e(p.jmeno || '')}${p.rok ? ', ' + e(p.rok) : ''}</div></div>
      <div class="body">
        <section class="sec navy"><h3>DIAGNÓZA</h3><div class="val" style="white-space:pre-wrap">${e(plan.dg || 'neuvedena')}</div>${KP.dgPopisRadky(plan.dg, b.dgPopisy).map((r) => `<div class="dgpopis"><b>${e(r.kod)}</b> – ${e(r.popis)}</div>`).join('')}${plan.funkce ? `<div class="lbl">Funkční stav</div><div class="val">${e(plan.funkce)}</div>` : ''}</section>
        <section class="sec red"><h3>LIMITACE PÉČE</h3>
          ${plan.kpr === 'dvp' ? `<div class="pill">DŘÍVE VYSLOVENÉ PŘÁNÍ</div><div class="lbl" style="margin-top:0">living will – podepsáno</div>
            ${limity.length ? `<div class="val">Nepřeje si: <b>${e(limity.join(', '))}</b></div>` : ''}`
          : plan.kpr === 'neuvedeno' ? `<div class="pill neutral">KPR: neuvedeno</div><div class="lbl" style="margin-top:0">pacient nemá podepsané dříve vyslovené přání</div>`
          : `<div class="pill ${kpr ? '' : 'ok'}">KPR: ${kpr ? 'NE' : 'ANO'}</div>${dalsi.length ? `<div class="val">Dále ne: ${e(dalsi.join(', '))}</div>` : ''}`}
          <div class="lbl">Cíl péče</div><div class="val">${e(KP.CILE[plan.cil] || '—')}</div>
          ${plan.kpr === 'neuvedeno' ? '' : `<div class="lbl">Doklad</div><div class="val">${KP.dokladHTML(doklad)}</div>
          ${doklad.original || doklad.zprava ? `<div class="lbl" style="margin-top:2px">${e(doklad.dvp && doklad.original ? 'originál: ' + doklad.original : 'zápis: ' + (doklad.zprava || ''))}</div>` : ''}`}
        </section>
        <section class="sec amber"><h3>ALERGIE</h3><div class="val">${e(plan.alergie || 'neuvedeno')}</div></section>
        <section class="sec violet"><h3>MEDIKACE${leky.zdroj === 'pecedoma' ? ' · PéčeDoma' : ''}</h3>
          <div class="lbl">Opioidy</div>${leky.opioidy.map((s) => `<div class="val">${e(s)}</div>`).join('') || '<div class="val">žádné</div>'}
          <div class="lbl">SOS medikace</div>${leky.sos.map((s) => `<div class="val">${e(s)}</div>`).join('') || '<div class="val">neuvedena</div>'}
          ${plan.terapieNaKarte && leky.medikace.length ? `<div class="lbl">Paliativní terapie</div>${leky.medikace.map((s) => `<div class="val">${e(s)}</div>`).join('')}` : ''}
        </section>
        <section class="sec blue"><h3>KOHO VOLAT</h3>
          ${first ? `<div class="callblk first"><div class="lbl">Nejdřív volat</div><div class="val"><b>${e(String(first.jmeno).replace(/ \(24\/7\)/, ''))}</b></div>${KP.telHTML(first.tel)}</div>` : ''}
          <div class="callblk"><div class="lbl">${g.odbornyZastupce ? 'Odborný zástupce' : 'Lékař plánu'}${g.poskytovatel ? ' · ' + e(g.poskytovatel) : ''}</div><div class="val">${e(lekarJm)}</div>${KP.telHTML(lekarTel)}</div>
          ${dalsiKontakty.map((r) => `<div class="callblk"><div class="lbl">${SKUP_NAZ[r.skupina] || e(r.skupina)}${r.pozn ? ' · ' + e(r.pozn) : ''}</div><div class="val">${e(r.jmeno)}</div>${KP.telHTML(r.tel)}</div>`).join('')}
        </section>
        ${last ? `<section class="sec red"><h3>${zh ? 'AKTUÁLNÍ ZHORŠENÍ' : 'POSLEDNÍ ZÁPIS'} · ${e(KP.fmtDT(last.cas))} · ${e(last.autor)}</h3><div class="val">${e(last.text)}</div></section>` : ''}
      </div>
      ${tlacitka ? `<div class="foot">${tlacitka}</div>` : ''}
    </div>`;
  };

  KP.ROLE = { lekar: 'lékař / spec. sestra', sestra: 'sestra', rodina: 'rodina', hospic: 'hospic', pl: 'praktický lékař', zzs: 'ZZS', system: 'systém', pacient: 'pacient' };
  KP.SYSTEM_TYPY = ['Systém', 'Úprava údajů'];   // zápisy o nastavování, ne o pacientovi
  /* deník: primárně jen zápisy o pacientovi; systémové (párování, propojení, změna čísla…) jsou sbalené na konci */
  KP.denikHTML = (denik, { role = true, system = true } = {}) => {
    if (!system) return KP.denikSeznam(denik, { role });
    const vse = denik || [], sys = vse.filter((e) => KP.SYSTEM_TYPY.includes(e.typ)), pac = vse.filter((e) => !KP.SYSTEM_TYPY.includes(e.typ));
    return KP.denikSeznam(pac, { role }) + (sys.length ? `<details class="vysv"><summary>Systémové záznamy <span class="chip">${sys.length}</span></summary><div class="vysv-b">${KP.denikSeznam(sys, { role })}</div></details>` : '');
  };
  KP.denikSeznam = (denik, { role = true } = {}) => `<ul class="diary">${[...(denik || [])].reverse().map((e) => `<li class="${/Zhoršení|ZZS/.test(e.typ) ? 'crit' : /stabilizován/.test(e.typ) ? 'ok' : ''}"><div class="when">${KP.esc(KP.fmtDT(e.cas))} · <span class="who">${KP.esc(e.autor)}${role && e.role ? ' · ' + KP.esc(KP.ROLE[e.role] || e.role) : ''}${e.overeno === false || e.overeno === 0 ? ' · <span class="chip warn">neověřeno</span>' : ''}${e.cekaNaOdeslani ? ' · <span class="chip">čeká na odeslání</span>' : ''}</span></div><div><span class="chip ${/SOS/.test(e.typ) ? 'warn' : /Zhoršení|ZZS/.test(e.typ) ? 'crit' : /Založení|Revize|Ukončení|Předání/.test(e.typ) ? 'acc' : /Úprava|Systém/.test(e.typ) ? 'vio' : ''}">${KP.esc(e.typ)}</span><div style="margin-top:4px;white-space:pre-wrap">${KP.esc(e.text)}</div></div></li>`).join('') || '<li class="muted">Zatím žádné zápisy.</li>'}</ul>`;

  window.KP = KP;
})();
