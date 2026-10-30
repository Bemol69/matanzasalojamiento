import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const root = path.resolve(import.meta.dirname, '..');
const P = (...a) => path.join(root, ...a);
const dist = P('dist');
const warn = (m) => console.warn('⚠ ' + m);

const readJson = (f, def) => {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); }
  catch (e) { warn(`${path.relative(root, f)} dañado o ausente, uso valores por defecto`); return def; }
};
const esc = (s = '') => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const cfg = readJson(P('sitio.config.json'), { nombre: 'Matanzas Alojamiento', dominio: '', seo: {} });
const aj = { whatsapp: '', mensaje_defecto: 'Hola!', instagram: '', correo: '', direccion: '', ciudad: '', region: '', lema: '', subtitulo: '', horario: [], ...readJson(P('data/ajustes.json'), {}) };
const fl = { mostrar: false, popup: false, imagen: '', titulo: '', texto: '', mensaje: '', ...readJson(P('data/flyer.json'), {}) };

if (aj.whatsapp && !/^569\d{8}$/.test(aj.whatsapp)) { warn(`WhatsApp "${aj.whatsapp}" no tiene formato 569XXXXXXXX: se oculta`); aj.whatsapp = ''; }

// vaciar dist por dentro
fs.mkdirSync(dist, { recursive: true });
for (const f of fs.readdirSync(dist)) fs.rmSync(path.join(dist, f), { recursive: true, force: true });
fs.mkdirSync(P('dist/img'), { recursive: true });

// imágenes -> webp 640 y 1100
const cache = new Map();
async function img(rel) {
  if (!rel) return null;
  if (cache.has(rel)) return cache.get(rel);
  const src = P('assets', rel);
  if (!fs.existsSync(src)) { warn(`falta foto ${rel}`); return null; }
  const base = slug(path.basename(rel, path.extname(rel)));
  const r = { m: `img/${base}-640.webp`, l: `img/${base}-1100.webp` };
  await sharp(src).rotate().resize({ width: 640, withoutEnlargement: true }).webp({ quality: 74 }).toFile(P('dist', r.m));
  await sharp(src).rotate().resize({ width: 1100, withoutEnlargement: true }).webp({ quality: 76 }).toFile(P('dist', r.l));
  cache.set(rel, r); return r;
}

// alojamientos
const dir = P('data/productos');
let prods = fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => ({ id: f.replace('.json', ''), ...readJson(path.join(dir, f), {}) }))
  .filter(p => p.visible !== false && p.nombre).sort((a, b) => (a.orden ?? 99) - (b.orden ?? 99));
if (prods.length > 10) { warn('más de 10 alojamientos: la demo se limita a 10'); prods = prods.slice(0, 10); }

const waUrl = (t) => `https://api.whatsapp.com/send?phone=${aj.whatsapp}&text=${encodeURIComponent(t)}`;
const waBase = aj.whatsapp ? waUrl(aj.mensaje_defecto) : '';

let cards = '';
const datosProd = [];
for (const p of prods) {
  const cover = await img(p.portada);
  const gal = [];
  for (const f of [p.portada, ...(p.fotos || [])]) { const r = await img(f); if (r) gal.push(r.l); }
  datosProd.push({ id: p.id, nombre: p.nombre, galeria: gal });
  const meta = [p.capacidad, p.categoria].filter(Boolean).join(' · ');
  const btn = aj.whatsapp ? `<a class="btn btn--sm" href="${esc(waUrl(`Hola! Quiero info de ${p.nombre} 👋`))}">${p.precio ? 'Reservar' : 'Consultar'}</a>` : '';
  cards += `<article class="card reveal" data-id="${esc(p.id)}" data-cat="${esc(p.categoria)}"><button class="card__open" aria-label="Ver fotos de ${esc(p.nombre)}"><figure class="arch">` +
    (cover ? `<img src="${cover.m}" srcset="${cover.m} 640w, ${cover.l} 1100w" sizes="(min-width:900px) 380px, 90vw" width="640" height="800" loading="lazy" alt="${esc(p.nombre)}">` : '') +
    (p.etiqueta ? `<figcaption class="tag">${esc(p.etiqueta)}</figcaption>` : '') +
    `</figure></button><div class="card__body"><p class="meta">${esc(meta)}</p><h3>${esc(p.nombre)}</h3><p class="desc">${esc(p.descripcion)}</p>` +
    `<div class="card__foot"><span class="price">${p.precio ? esc(p.precio) + ' <small>/ noche</small>' : 'Consulta valores'}</span>${btn}</div></div></article>`;
}

const cats = [...new Set(prods.map(p => p.categoria).filter(Boolean))];
const filtros = cats.length > 1
  ? `<button data-cat="*" aria-pressed="true">Todos</button>` + cats.map(c => `<button data-cat="${esc(c)}" aria-pressed="false">${esc(c)}</button>`).join('')
  : '';
const opciones = prods.map(p => `<option>${esc(p.nombre)}</option>`).join('') + '<option>Aún no sé, quiero que me ayuden</option>';

// hero
const hero = await img(cfg.hero_foto || prods[0]?.portada);
const og = await img(prods[0]?.portada);
const dom = (cfg.dominio || '').replace(/\/$/, '');
const mapq = encodeURIComponent(aj.direccion || '');

// JSON-LD
const ld = {
  '@context': 'https://schema.org', '@type': cfg.schema_tipo || 'LocalBusiness', name: cfg.nombre, url: dom || undefined,
  image: og && dom ? `${dom}/${og.l}` : undefined, description: cfg.seo?.descripcion,
  sameAs: aj.instagram ? [`https://www.instagram.com/${aj.instagram}/`] : undefined,
  address: { '@type': 'PostalAddress', addressLocality: aj.ciudad, addressRegion: aj.region, addressCountry: 'CL' },
  telephone: aj.whatsapp ? '+' + aj.whatsapp : undefined
};
const dias = { lunes: 'Monday', martes: 'Tuesday', miércoles: 'Wednesday', miercoles: 'Wednesday', jueves: 'Thursday', viernes: 'Friday', sábado: 'Saturday', sabado: 'Saturday', domingo: 'Sunday' };
const spec = (aj.horario || []).filter(h => !h.cerrado && dias[h.dia?.toLowerCase()]).map(h => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: dias[h.dia.toLowerCase()], opens: h.abre, closes: h.cierra }));
if (spec.length) ld.openingHoursSpecification = spec;

// assets con hash
const hashed = (name, ext) => {
  const buf = fs.readFileSync(P('src', `${name}.${ext}`));
  const h = crypto.createHash('md5').update(buf).digest('hex').slice(0, 8);
  const out = `${name}.${h}.${ext}`;
  fs.writeFileSync(P('dist', out), buf); return out;
};
const css = hashed('styles', 'css'), js = hashed('app', 'js');

const flyerImg = fl.imagen ? await img(fl.imagen.replace(/^\/?(assets\/)?/, '')) : null;

const datos = { ajustes: { emoji: cfg.emoji || '✨', whatsapp: aj.whatsapp, horario: aj.horario || [] }, productos: datosProd, flyer: { popup: !!fl.popup } };

const vars = {
  TITULO: esc(cfg.seo?.titulo || cfg.nombre), DESC: esc(cfg.seo?.descripcion || ''), CANON: dom + '/', NOMBRE: esc(cfg.nombre),
  OG: og && dom ? `${dom}/${og.l}` : '', CSS: css, JS: js, JSONLD: JSON.stringify(ld).replace(/</g, '\\u003c'),
  LEMA: esc(aj.lema), SUBTITULO: esc(aj.subtitulo), WA_BASE: esc(waBase), IG: esc(aj.instagram), SEGUIDORES: cfg.seguidores || '',
  HERO_M: hero?.m || '', HERO_L: hero?.l || '', TARJETAS: cards, FILTROS: filtros, OPCIONES: opciones,
  CIUDAD: esc(aj.ciudad), REGION: esc(aj.region), CORREO: esc(aj.correo), DIRECCION: esc(aj.direccion),
  MAPSRC: `https://www.google.com/maps?q=${mapq}&output=embed`, MAPLINK: `https://www.google.com/maps/search/?api=1&query=${mapq}`,
  DATOS: JSON.stringify(datos).replace(/</g, '\\u003c'),
  FLYER_IMG: flyerImg ? `<img src="${flyerImg.l}" alt="${esc(fl.titulo)}">` : '', FLYER_TITULO: esc(fl.titulo), FLYER_TEXTO: esc(fl.texto),
  FLYER_WA: aj.whatsapp ? esc(waUrl(fl.mensaje || aj.mensaje_defecto)) : ''
};
vars.N = String(prods.length);
const flags = { WHATSAPP: !!aj.whatsapp, DIRECCION: !!aj.direccion, HORARIO: (aj.horario || []).length > 0, FLYER: !!fl.mostrar && !!(fl.titulo || fl.imagen), CORREO: !!aj.correo };

let html = fs.readFileSync(P('src/index.html'), 'utf8');
for (const [k, on] of Object.entries(flags)) {
  const re = new RegExp(`<!-- SI:${k} -->([\\s\\S]*?)<!-- /SI:${k} -->`, 'g');
  html = html.replace(re, on ? '$1' : '');
}
html = html.replace(/%%([A-Z_]+)%%/g, (_, k) => k in vars ? vars[k] : (warn(`marcador sin valor %%${k}%%`), ''));
fs.writeFileSync(P('dist/index.html'), html);

// copiar admin y data
fs.cpSync(P('admin'), P('dist/admin'), { recursive: true });
fs.cpSync(P('data'), P('dist/data'), { recursive: true });
fs.writeFileSync(P('dist/robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n${dom ? `Sitemap: ${dom}/sitemap.xml\n` : ''}`);
fs.writeFileSync(P('dist/sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${dom}/</loc></url></urlset>\n`);

const kb = (f) => (fs.statSync(P('dist', f)).size / 1024).toFixed(0);
console.log(`OK · ${prods.length} alojamientos · html ${kb('index.html')} KB · css ${kb(css)} KB · js ${kb(js)} KB`);
