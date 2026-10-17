/* Společné funkce pro centrální aplikaci, kartu na mobilu a správu tenantů. */
(function () {
  const KP = {};
  KP.CILE = { symptom: 'Symptomatická (úleva od obtíží)', limited: 'Omezená (léčba bez resuscitace a intenzivní péče)', full: 'Plná léčba' };
  KP.LIMITY = ['KPR', 'Umělá plicní ventilace', 'Hospitalizace', 'Antibiotika i.v.', 'Infuze / i.v. výživa', 'Sonda / PEG', 'Dialýza', 'Transfuze'];
  KP.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  KP.fmtD = (iso) => { if (!iso) return '—'; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${+d}. ${+m}. ${y}`; };
  KP.fmtDT = (s) => { if (!s) return '—'; const t = String(s).replace('T', ' '); return `${KP.fmtD(t.slice(0, 10))} ${t.slice(11, 16)}`; };
  KP.dnes = () => new Date().toISOString().slice(0, 10);
  KP.prosly = (iso) => !!iso && iso < KP.dnes();
  KP.casLokalni = () => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
  KP.uuid = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15); return (c === 'x' ? r : (r & 3) | 8).toString(16); }));

  KP.toast = (m) => { let t = document.getElementById('toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); } t.textContent = m; t.hidden = false; clearTimeout(t._h); t._h = setTimeout(() => (t.hidden = true), 3200); };
  KP.modal = (html, bind) => {
    let m = document.getElementById('modal'); if (!m) { m = document.createElement('div'); m.id = 'modal'; document.body.appendChild(m); }
    m.innerHTML = `<div class="modal"><div class="box"><div class="grab"></div>${html}</div></div>`;
    m.querySelector('.modal').onclick = (e) => { if (e.target.classList.contains('modal')) KP.closeModal(); };
    m.querySelectorAll('[data-close]').forEach((b) => (b.onclick = KP.closeModal));
    if (bind) bind(m);
  };
  KP.closeModal = () => { const m = document.getElementById('modal'); if (m) m.innerHTML = ''; };
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
    karta: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="3"/><path d="M7 9h10M7 13h6"/></svg>',
    plan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l2 2 4-4"/><rect x="4" y="3" width="16" height="18" rx="3"/></svg>',
    denik: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 5h12a3 3 0 013 3v11H7a3 3 0 00-3 3z"/><path d="M8 9h7M8 13h7"/></svg>',
    zhorseni: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l9 17H3z"/><path d="M12 10v4M12 17h.01"/></svg>',
    kontakty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2z"/></svg>',
    udaje: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>',
    dok: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h6"/></svg>',
    back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 5l-7 7 7 7"/></svg>',
    zamek: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>',
    sync: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5"/></svg>',
  };

  /** Aktivní zhoršení = poslední krizový zápis je „Zhoršení stavu“. */
  KP.aktivniZhorseni = (denik) => {
    const krize = (denik || []).filter((e) => ['Zhoršení stavu', 'Stav stabilizován', 'Výjezd ZZS', 'Ukončení'].includes(e.typ));
    const l = krize[krize.length - 1];
    return l && l.typ === 'Zhoršení stavu' ? l : null;
  };

  /** Krizová karta z balíku (stejný tvar posílá server telefonu i centrální aplikaci). */
  KP.kartaHTML = (b, { tlacitka = '' } = {}) => {
    const p = b.pacient || {}; const plan = (b.plan && b.plan.data) || {}; const platnost = b.plan && b.plan.platnostDo;
    const kontakty = (b.kontakty || []).map((k) => ({ ...k, skupina: String(k.skupina || '').toLowerCase() }));
    const g = b.garant || {};
    const first = kontakty.find((k) => /hospic/i.test(k.jmeno) && k.skupina === 'pecuje') || kontakty.find((k) => k.skupina === 'pecuje') || (g.telefon24 ? { jmeno: g.poskytovatel, tel: g.telefon24 } : null);
    const rozh = kontakty.filter((k) => k.skupina === 'rozhoduje');
    const limity = plan.limity || []; const kpr = limity.includes('KPR');
    const dalsi = limity.filter((l) => l !== 'KPR');
    const doklad = plan.doklad || {};
    const zh = KP.aktivniZhorseni(b.denik);
    const last = zh || (b.denik || []).filter((e) => e.typ !== 'Systém').slice(-1)[0];
    const exp = !b.plan || KP.prosly(platnost);
    const lekarJm = (b.plan && b.plan.podepsal) || g.lekar || '—';
    const lekarTel = g.lekarTelefon || g.telefon24 || '';
    const e = KP.esc;
    return `<div class="card">
      <div class="hdr"><div class="row" style="justify-content:space-between"><span>KRIZOVÝ PLÁN PÉČE · ${e(p.kod || '')}</span><span class="valid ${exp ? 'exp' : ''}">${!b.plan ? 'BEZ PLÁNU' : exp ? 'ČEKÁ NA REVIZI' : 'platí do ' + KP.fmtD(platnost)}</span></div>
        <div class="name">${e(p.prijmeni || '')} ${e(p.jmeno || '')}${p.rok ? ', ' + e(p.rok) : ''}</div></div>
      <div class="body">
        <section class="sec red"><h3>LIMITACE PÉČE</h3>
          <div class="pill ${kpr ? '' : 'ok'}">KPR: ${kpr ? 'NE' : 'ANO'}</div>
          ${dalsi.length ? `<div class="val">Dále ne: ${e(dalsi.join(', '))}</div>` : ''}
          <div class="lbl">Cíl péče</div><div class="val">${e(KP.CILE[plan.cil] || '—')}</div>
          <div class="lbl">Doklad</div><div class="val">${doklad.dvp ? `dříve vyslovené přání${doklad.datum ? ' z ' + KP.fmtD(doklad.datum) : ''}` : '<span class="chip warn">bez dříve vysloveného přání</span> rozhodnutí lékaře'}</div>
          ${doklad.original || doklad.zprava ? `<div class="lbl" style="margin-top:2px">${e(doklad.dvp && doklad.original ? 'originál: ' + doklad.original : 'zápis: ' + (doklad.zprava || ''))}</div>` : ''}
        </section>
        <section class="sec amber"><h3>ALERGIE A SOS LÉKY</h3>
          <div class="val"><b>Alergie:</b> ${e(plan.alergie || 'neuvedeno')}</div>
          <div class="lbl">SOS léky</div>${(plan.sos || []).map((s) => `<div class="val">${e(s)}</div>`).join('') || '<div class="val">neuvedeny</div>'}
        </section>
        <section class="sec blue"><h3>KOHO VOLAT</h3>
          ${first ? `<a class="callrow first" href="tel:${e(String(first.tel).replace(/\s/g, ''))}" style="color:inherit;text-decoration:none"><span>Nejdřív: ${e(String(first.jmeno).replace(/ \(24\/7\)/, ''))}</span><span class="num">${e(first.tel)}</span></a>` : ''}
          <div class="callrow"><span><span class="lbl" style="margin:0">Lékař plánu${g.poskytovatel ? ' · ' + e(g.poskytovatel) : ''}</span><br>${e(lekarJm)}</span>${lekarTel ? `<a class="num" href="tel:${e(lekarTel.replace(/\s/g, ''))}">${e(lekarTel)}</a>` : ''}</div>
          ${rozh.map((r) => `<div class="callrow"><span><span class="lbl" style="margin:0">Rozhoduje</span><br>${e(r.jmeno)}</span><a class="num" href="tel:${e(String(r.tel).replace(/\s/g, ''))}">${e(r.tel)}</a></div>`).join('')}
        </section>
        ${last ? `<section class="sec violet"><h3>${zh ? 'AKTUÁLNÍ ZHORŠENÍ' : 'POSLEDNÍ ZÁPIS'} · ${e(KP.fmtDT(last.cas))} · ${e(last.autor)}</h3><div class="val">${e(last.text)}</div></section>` : ''}
      </div>
      ${tlacitka ? `<div class="foot">${tlacitka}</div>` : ''}
    </div>`;
  };

  KP.denikHTML = (denik, { role = true } = {}) => `<ul class="diary">${[...(denik || [])].reverse().map((e) => `<li><div class="when">${KP.esc(KP.fmtDT(e.cas))} · <span class="who">${KP.esc(e.autor)}${role && e.role ? ' · ' + KP.esc(e.role) : ''}${e.overeno === false || e.overeno === 0 ? ' · <span class="chip warn">neověřeno</span>' : ''}${e.cekaNaOdeslani ? ' · <span class="chip">čeká na odeslání</span>' : ''}</span></div><div><span class="chip ${/SOS/.test(e.typ) ? 'warn' : /Zhoršení|ZZS/.test(e.typ) ? 'crit' : /Založení|Revize|Ukončení|Předání/.test(e.typ) ? 'acc' : /Úprava|Systém/.test(e.typ) ? 'vio' : ''}">${KP.esc(e.typ)}</span><div style="margin-top:4px;white-space:pre-wrap">${KP.esc(e.text)}</div></div></li>`).join('') || '<li class="muted">Zatím žádné zápisy.</li>'}</ul>`;

  window.KP = KP;
})();
