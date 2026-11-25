import { createHash, randomUUID } from "node:crypto";
import { parse } from "parse5";

const names = {
  beranda: "Beranda", produk: "Produk", tentang: "Tentang", legalitas: "Legalitas",
  "visi-misi": "Visi & Misi", "nilai-utama": "Nilai Utama", "kenapa-kami": "Kenapa Kami",
  layanan: "Layanan", kontak: "Kontak"
};
const labels = {
  title: "Judul tab", h1: "Judul utama", h2: "Judul bagian", h3: "Judul",
  p: "Paragraf", a: "Teks tautan", label: "Label formulir", option: "Pilihan formulir",
  button: "Teks tombol", li: "Butir daftar", small: "Keterangan"
};
const contactLabels = { email: "Email perusahaan", phone: "Telepon publik", address: "Alamat" };
const metadata = {
  description: "Deskripsi mesin pencari", "og:site_name": "Nama situs saat dibagikan",
  "og:title": "Judul saat dibagikan", "og:description": "Deskripsi saat dibagikan",
  "og:image": "Foto saat dibagikan", "og:image:alt": "Deskripsi foto saat dibagikan"
};
const collections = {
  "visi-misi": { target: (node) => node.tagName === "ul", label: "Tambah poin misi" },
  "nilai-utama": { target: (node) => hasClass(node, "values-grid"), label: "Tambah nilai utama", heading: "Nama nilai" },
  legalitas: { target: (node) => hasClass(node, "legality-list"), label: "Tambah dokumen legalitas" },
  layanan: { target: (node) => hasClass(node, "service-grid"), label: "Tambah layanan", heading: "Nama layanan" },
  "kenapa-kami": { target: (node) => hasClass(node, "why-points"), label: "Tambah keunggulan", heading: "Judul keunggulan" }
};
const attr = (node, key) => node.attrs?.find(({ name }) => name === key)?.value;
const hasClass = (node, key) => attr(node, "class")?.split(/\s+/).includes(key);
const content = (node) => node.nodeName === "#text"
  ? node.value
  : (node.childNodes || []).map(content).join("");
const flat = (node) => [node, ...(node.childNodes || []).flatMap(flat)];
const tidy = (value) => value.replace(/\s+/g, " ").trim();
const escape = (value) => value.replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
}[character]));

export const revision = (html) => createHash("sha256").update(html).digest("hex");

function fail(message) {
  throw Object.assign(new Error(message), { status: 400 });
}

function string(value, label, max, required = true) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) {
    fail(`${label} harus diisi dengan benar (maksimum ${max} karakter).`);
  }
  return value.trim();
}

export function imagePath(value) {
  return /^(?:\.\/)?images\/[\p{L}\p{N} _.-]+\.(?:png|jpe?g|webp|gif)$/iu.test(value)
    && !value.includes("..");
}

function checkedImage(value, images) {
  if (!imagePath(value) || !images.has(value.replace(/^\.\//, ""))) {
    fail("Pilih foto dari folder images atau unggah foto terlebih dahulu.");
  }
  return value;
}

function checkedMaps(value, embed) {
  let url;
  try { url = new URL(value); } catch { fail("Masukkan URL Google Maps yang lengkap."); }
  const valid = embed
    ? (url.hostname === "maps.google.com" && url.pathname === "/maps" && url.searchParams.get("output") === "embed")
      || (url.hostname === "www.google.com" && url.pathname === "/maps/embed")
    : (url.hostname === "maps.app.goo.gl" && /^\/[\da-z]+\/?$/i.test(url.pathname))
      || (["www.google.com", "maps.google.com"].includes(url.hostname) && /^\/maps(?:\/|$)/.test(url.pathname));
  if (url.protocol !== "https:" || url.username || url.password || url.port || !valid) {
    fail("Gunakan tautan HTTPS dari Google Maps yang sesuai.");
  }
  return value;
}

function locationPatch(location, value) {
  return { start: location.startOffset, end: location.endOffset, value };
}

function fieldsFor(root, skip) {
  const fields = [];
  function add(location, label, kind, value, attribute) {
    if (!location) return;
    fields.push({ id: String(location.startOffset), label, kind, value, attribute, location });
  }
  function visit(node, label) {
    if (node !== root && skip.has(node)) return;
    const type = node.tagName;
    if (["script", "style", "template"].includes(type) || attr(node, "aria-hidden") === "true" && type !== "iframe"
        || attr(node, "data-catalog-option") !== undefined || hasClass(node, "product-card")) return;
    const location = node.sourceCodeLocation;
    const addAttribute = (name, title, kind = "text") => {
      const value = attr(node, name);
      if (value !== undefined) add(location?.attrs?.[name], title, kind, value, name);
    };
    if (node.nodeName === "#text") {
      const value = tidy(node.value);
      if (/\p{L}/u.test(value)) add(location, label || "Teks", label === "Paragraf" ? "long" : "text", value);
      return;
    }
    if (type === "meta") {
      const key = attr(node, "name") || attr(node, "property");
      if (metadata[key]) addAttribute("content", metadata[key], key === "og:image" ? "social-image" : "text");
    }
    if (type === "img") {
      addAttribute("src", "Foto", "image");
      addAttribute("alt", "Deskripsi foto");
    }
    if (type === "input" || type === "textarea" || type === "select") {
      const title = ({ name: "nama", company: "perusahaan", service: "produk atau layanan", message: "detail kebutuhan" })[attr(node, "name")];
      if (title) {
        addAttribute("placeholder", "Contoh isian " + title);
        addAttribute("data-required-message", "Pesan wajib isi " + title);
      }
    }
    if (type === "form") addAttribute("data-whatsapp", "Nomor tujuan WhatsApp", "whatsapp");
    if (type === "iframe" && hasClass(node.parentNode, "contact-map")) addAttribute("src", "URL pratinjau Maps", "map-embed");
    if (type === "a" && hasClass(node.parentNode, "contact-map")) addAttribute("href", "Tautan Google Maps", "map");
    const nextLabel = contactLabels[attr(node, "data-contact")] || labels[type] || label;
    for (const child of node.childNodes || []) visit(child, nextLabel);
  }
  visit(root);
  return fields;
}

function model(html) {
  const document = parse(html, { sourceCodeLocationInfo: true });
  const nodes = flat(document);
  const one = (predicate) => nodes.find(predicate);
  const root = (id) => one((node) => attr(node, "id") === id);
  const sections = nodes.filter((node) => node.tagName === "section"
    && (Object.hasOwn(names, attr(node, "id")) || attr(node, "data-admin-section") !== undefined));
  const header = one((node) => node.tagName === "header");
  const top = one((node) => hasClass(node, "top-strip"));
  const stats = one((node) => hasClass(node, "stats-section"));
  const footer = one((node) => node.tagName === "footer");
  const head = one((node) => node.tagName === "head");
  const skip = new Set(sections);
  const groups = new Map([
    ["header", { name: "Header & Menu", fields: [...fieldsFor(top, skip), ...fieldsFor(header, skip)] }],
    ...sections.map((section) => {
      const id = attr(section, "id");
      const custom = attr(section, "data-admin-section") !== undefined;
      const heading = flat(section).find((node) => node.tagName === "h2");
      return [id, { name: Object.hasOwn(names, id) ? names[id] : tidy(content(heading)), custom, section, fields: fieldsFor(section, skip) }];
    }),
    ["footer", { name: "Footer", fields: fieldsFor(footer, skip) }],
    ["metadata", { name: "Pratinjau & SEO", fields: fieldsFor(head, skip) }]
  ]);
  groups.get("beranda").fields.push(...fieldsFor(stats, skip));
  const layout = one((node) => hasClass(node, "products-layout"));
  const cards = layout.childNodes.filter((node) => hasClass(node, "product-card"));
  const products = cards.map((card) => {
    const children = flat(card);
    const get = (predicate) => children.find(predicate);
    const image = get((node) => node.tagName === "img");
    return {
      name: tidy(content(get((node) => node.tagName === "h3"))),
      badge: tidy(content(get((node) => hasClass(node, "product-badge")))),
      description: tidy(content(get((node) => node.tagName === "p"))),
      image: attr(image, "src"), alt: attr(image, "alt")
    };
  });
  return { groups, layout, cards, products, select: root("service"), contact: root("kontak") };
}

export function readSite(html) {
  const { groups, products } = model(html);
  return {
    revision: revision(html), products,
    sections: [...groups].map(([id, group]) => ({
      id, name: group.name, custom: Boolean(group.custom), canAdd: Boolean(group.section),
      addition: collections[id] ? { label: collections[id].label, heading: collections[id].heading } : null,
      fields: group.fields.map(({ id, label, kind, value }) => ({ id, label, kind, value }))
    }))
  };
}

function editField(field, input, images, html) {
  const value = string(input, field.label, 2000, field.label !== "Deskripsi foto");
  if (value === field.value) return null;
  if (field.kind === "image") checkedImage(value, images);
  if (field.kind === "social-image" && !/^https:\/\/[^\s]+$/i.test(value)) checkedImage(value, images);
  if (field.kind === "map" || field.kind === "map-embed") checkedMaps(value, field.kind === "map-embed");
  if (field.kind === "whatsapp" && !/^\+?[1-9]\d{6,14}$/.test(value)) fail("Gunakan nomor WhatsApp internasional, misalnya 62812…");
  if (field.label === "Email perusahaan" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) fail("Masukkan alamat email yang valid.");
  const original = html.slice(field.location.startOffset, field.location.endOffset);
  return locationPatch(field.location, field.attribute
    ? `${field.attribute}="${escape(value)}"`
    : original.replace(/^(\s*)[\s\S]*?(\s*)$/, (_match, left, right) => left + escape(value) + right));
}

function editProducts(site, input, images) {
  if (!Array.isArray(input) || input.length > 100) fail("Katalog dapat memuat hingga 100 produk.");
  const seen = new Set();
  const products = input.map((item) => {
    const name = tidy(string(item?.name, "Nama produk", 100));
    const key = name.toLowerCase();
    if (seen.has(key)) fail(`Nama produk duplikat: ${name}.`);
    seen.add(key);
    return {
      name, badge: string(item?.badge, "Label produk", 60),
      description: string(item?.description, "Deskripsi produk", 1800),
      image: checkedImage(string(item?.image, "Foto produk", 300), images),
      alt: string(item?.alt || name, "Deskripsi foto", 200)
    };
  });
  if (JSON.stringify(products) === JSON.stringify(site.products)) return [];
  const cards = products.map(({ name, badge, description, image, alt }) => `<article class="product-card">
        <div class="product-image">
          <img src="${escape(image)}" alt="${escape(alt)}" loading="lazy">
          <span class="product-badge">${escape(badge)}</span>
        </div>
        <div class="product-body">
          <h3>${escape(name)}</h3>
          <p>${escape(description)}</p>
          <a href="#kontak" class="product-link" data-product="${escape(name)}" aria-label="Konsultasi produk ${escape(name)}">→</a>
        </div>
      </article>`);
  const cardStart = site.cards[0]?.sourceCodeLocation.startOffset ?? site.layout.sourceCodeLocation.endTag.startOffset;
  const cardEnd = site.cards.at(-1)?.sourceCodeLocation.endOffset ?? cardStart;
  const options = site.select.childNodes.filter((node) => node.tagName === "option");
  const old = options.filter((node) => attr(node, "data-catalog-option") !== undefined);
  const fixed = new Set(options.filter((node) => !old.includes(node)).map((node) => tidy(content(node))));
  const newOptions = products.filter(({ name }) => !fixed.has(name))
    .map(({ name }) => `<option data-catalog-option value="${escape(name)}">${escape(name)}</option>`).join("");
  const insert = options[0].sourceCodeLocation.endOffset;
  return [
    { start: cardStart, end: cardEnd, value: cards.length ? "\n      " + cards.join("\n\n      ") + "\n    " : "" },
    ...old.map((node) => locationPatch(node.sourceCodeLocation, "")),
    { start: insert, end: insert, value: newOptions }
  ];
}

function addContent(group, id, block) {
  const spec = collections[id];
  const title = escape(string(block.title, spec?.heading || "Judul blok", 100, Boolean(spec?.heading)));
  const body = escape(string(block.body, "Isi", 2000));
  const target = spec ? flat(group.section).find(spec.target) : group.section;
  const number = String(target.childNodes.filter((child) => child.tagName).length + 1).padStart(2, "0");
  const templates = {
    "visi-misi": `<li>${body}</li>`,
    legalitas: `<li>${body}</li>`,
    "nilai-utama": `<div class="value-item"><h3>${title}</h3><p>${body}</p></div>`,
    layanan: `<article class="service-item"><div class="service-icon" aria-hidden="true">✓</div><h3>${title}</h3><p>${body}</p><a href="#kontak">Hubungi kami →</a></article>`,
    "kenapa-kami": `<div><span aria-hidden="true">${number}</span><p><strong>${title}</strong><small>${body}</small></p></div>`
  };
  const value = templates[id] || `<div class="container"><div class="editor-block">${title ? `<h3>${title}</h3>` : ""}<p>${body}</p></div></div>`;
  const start = target.sourceCodeLocation.endTag.startOffset;
  return { start, end: start, value: value + "\n" };
}

export function updateSite(html, input, images) {
  const site = model(html);
  const group = site.groups.get(input.section);
  if (!group && input.section !== "new") fail("Bagian tidak tersedia.");
  const patches = [];
  if (input.section === "new") {
    const title = string(input.title, "Judul bagian", 100);
    const body = string(input.body, "Isi bagian", 2000);
    const id = "bagian-" + randomUUID().slice(0, 12);
    const start = site.contact.sourceCodeLocation.startOffset;
    patches.push({ start, end: start, value: `<section class="section" id="${id}" data-admin-section aria-labelledby="${id}-judul">
      <div class="container">
        <h2 id="${id}-judul">${escape(title)}</h2>
        <p class="editor-paragraph">${escape(body)}</p>
      </div>
    </section>\n\n    ` });
  } else if (group.custom && input.remove === true) {
    patches.push(locationPatch(group.section.sourceCodeLocation, ""));
  } else {
    if (!input.fields || typeof input.fields !== "object") fail("Isi bagian tidak valid.");
    for (const field of group.fields) {
      if (!Object.hasOwn(input.fields, field.id)) continue;
      const patch = editField(field, input.fields[field.id], images, html);
      if (patch) patches.push(patch);
    }
    if (input.section === "produk") patches.push(...editProducts(site, input.products, images));
    if (group.section && input.block) patches.push(addContent(group, input.section, input.block));
  }
  return patches.sort((left, right) => right.start - left.start || right.end - left.end)
    .reduce((source, patch) => source.slice(0, patch.start) + patch.value + source.slice(patch.end), html);
}
