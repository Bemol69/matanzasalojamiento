(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const D = JSON.parse($('#datos').textContent);
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wa = (t) => `https://api.whatsapp.com/send?phone=${D.ajustes.whatsapp}&text=${encodeURIComponent(t)}`;

  // nav + sol que se pone al bajar (solo transform, rAF)
  const nav = $('#nav'), sun = $('#sun'), hero = $('#inicio');
  let tick = false;
  const onScroll = () => {
    if (tick) return; tick = true;
    requestAnimationFrame(() => {
      const y = scrollY;
      nav.classList.toggle('is-solid', y > 40);
      if (!reduce) hero.style.setProperty('--p', Math.min(1, y / hero.offsetHeight).toFixed(3));
      tick = false;
    });
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  const burger = $('#burger'), menu = $('#menu');
  burger.addEventListener('click', () => {
    const o = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', o);
  });
  $$('a', menu).forEach(a => a.addEventListener('click', () => { menu.classList.remove('open'); burger.setAttribute('aria-expanded', false); }));

  // revelados en cascada
  const rv = $$('.reveal');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((es) => es.forEach(e => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: .12 });
    rv.forEach((el, i) => { el.style.setProperty('--i', i % 4); io.observe(el); });
  } else rv.forEach(el => el.classList.add('in'));

  // filtros
  const grid = $('#grid');
  $$('.filtros button').forEach(b => b.addEventListener('click', () => {
    $$('.filtros button').forEach(x => x.setAttribute('aria-pressed', x === b));
    const c = b.dataset.cat;
    grid.classList.toggle('is-all', c === '*');
    $$('.card', grid).forEach(card => { card.hidden = c !== '*' && card.dataset.cat !== c; });
  }));

  // galería
  const gal = $('#gal'), img = $('#galimg'), cap = $('#galcap');
  let fotos = [], idx = 0;
  const show = () => { img.src = fotos[idx]; };
  $$('.card__open', grid).forEach(btn => btn.addEventListener('click', () => {
    const p = D.productos.find(x => x.id === btn.closest('.card').dataset.id);
    if (!p) return;
    fotos = p.galeria; idx = 0; img.alt = p.nombre; cap.textContent = p.nombre;
    gal.toggleAttribute('data-solo', fotos.length < 2);
    show(); gal.showModal();
  }));
  $('#galp').addEventListener('click', () => { idx = (idx - 1 + fotos.length) % fotos.length; show(); });
  $('#galn').addEventListener('click', () => { idx = (idx + 1) % fotos.length; show(); });
  $('#galx').addEventListener('click', () => gal.close());
  gal.addEventListener('click', (e) => { if (e.target === gal) gal.close(); });

  // formulario -> WhatsApp
  const form = $('#form');
  if (form) {
    const today = new Date().toISOString().slice(0, 10);
    form.llegada.min = today; form.salida.min = today;
    const fd = (v) => { const [y, m, d] = v.split('-'); return `${d}/${m}/${y}`; };
    const msg = () => {
      const f = form;
      return `*Hola! Quiero reservar* ${D.ajustes.emoji}\n\n👤 *Nombre:* ${f.nombre.value.trim() || '…'}\n🏡 *Alojamiento:* ${f.alojamiento.value}\n📅 *Llegada:* ${f.llegada.value ? fd(f.llegada.value) : '…'}\n📅 *Salida:* ${f.salida.value ? fd(f.salida.value) : '…'}\n👥 *Personas:* ${f.personas.value || '…'}` + (f.detalle.value.trim() ? `\n💬 ${f.detalle.value.trim()}` : '') + '\n\n_Enviado desde la web_';
    };
    const prev = $('#prev'), err = $('#error');
    const upd = () => { prev.textContent = msg(); };
    form.addEventListener('input', upd); upd();
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let m = '';
      if (!form.nombre.value.trim()) m = 'Escribe tu nombre.';
      else if (!form.llegada.value || !form.salida.value) m = 'Elige las fechas de llegada y salida.';
      else if (form.salida.value <= form.llegada.value) m = 'La salida debe ser después de la llegada.';
      else if (!(+form.personas.value > 0)) m = 'Indica cuántas personas son.';
      err.hidden = !m; err.textContent = m;
      if (!m) window.open(wa(msg()), '_blank', 'noopener');
    });
  }

  // horario abierto/cerrado (hora de Chile)
  const hz = D.ajustes.horario || [], hbox = $('#horario');
  if (hbox && hz.length) {
    hbox.hidden = false;
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const hm = s => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
    const render = () => {
      const p = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(new Date());
      const g = t => p.find(x => x.type === t).value;
      const hoy = norm(g('weekday')), now = +g('hour') % 24 * 60 + +g('minute');
      const row = hz.find(r => norm(r.dia) === hoy);
      let txt;
      if (row && !row.cerrado && now >= hm(row.abre) && now < hm(row.cierra)) txt = `🟢 Abierto ahora · cierra a las ${row.cierra}`;
      else if (row && !row.cerrado && now < hm(row.abre)) txt = `🔴 Cerrado · abre hoy a las ${row.abre}`;
      else {
        const i = dias.findIndex(d => norm(d) === hoy); txt = '🔴 Cerrado';
        for (let k = 1; k < 8; k++) { const n = dias[(i + k) % 7], r = hz.find(x => norm(x.dia) === norm(n)); if (r && !r.cerrado) { txt = `🔴 Cerrado · abre ${k === 1 ? 'mañana' : 'el ' + n} a las ${r.abre}`; break; } }
      }
      $('#estado').textContent = txt;
      $('#tabla').innerHTML = hz.map(r => `<li class="${norm(r.dia) === hoy ? 'hoy' : ''}"><span>${r.dia}</span><span>${r.cerrado ? 'Cerrado' : r.abre + ' – ' + r.cierra}</span></li>`).join('');
    };
    render(); setInterval(render, 60000);
  }

  // mapa diferido
  const mb = $('#mapbox');
  if (mb) {
    const load = () => { if (mb.querySelector('iframe')) return; mb.innerHTML = `<iframe src="${mb.dataset.src}" loading="lazy" referrerpolicy="no-referrer-when-downgrade" title="Mapa de Matanzas Alojamiento"></iframe>`; };
    $('#vermapa').addEventListener('click', load);
    if ('IntersectionObserver' in window) { const o = new IntersectionObserver(e => { if (e[0].isIntersecting) { load(); o.disconnect(); } }, { rootMargin: '300px' }); o.observe(mb); }
  }

  // flyer una vez por visita
  const fl = $('#flyer');
  if (fl) {
    $('#flyerx').addEventListener('click', () => fl.close());
    try { if (D.flyer.popup && !sessionStorage.getItem('fl')) { sessionStorage.setItem('fl', 1); setTimeout(() => fl.showModal(), 1800); } } catch (e) {}
  }
})();
