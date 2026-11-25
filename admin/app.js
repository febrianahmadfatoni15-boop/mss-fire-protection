const get = (id) => document.getElementById(id);
const editor = get("editor");
const saveButton = get("save");
const status = get("status");
let code = "";
let site;
let selected = "produk";
let values;
let products;
let block;
let dirty = false;
let busy = false;
let passwordConfigured = false;

function node(tag, className, text) {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== undefined) item.textContent = text;
  return item;
}

function button(text, action, className = "secondary") {
  const item = node("button", className, text);
  item.type = "button";
  item.addEventListener("click", action);
  return item;
}

function notice(text, error = false) {
  status.textContent = text;
  status.classList.toggle("error", error);
}

function requiredMessage(control, message) {
  control.addEventListener("invalid", () => {
    if (control.validity.valueMissing) control.setCustomValidity(message);
  });
  control.addEventListener("input", () => control.setCustomValidity(""));
}

async function api(path, options = {}) {
  const headers = new Headers(options.headers);
  if (code) headers.set("Authorization", "Bearer " + code);
  const response = await fetch(path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Terjadi kesalahan.");
  return data;
}

function field(label, value, update, options = {}) {
  const wrap = node("label", options.long ? "field wide" : "field");
  const control = node(options.long ? "textarea" : "input");
  control.value = value ?? "";
  control.required = Boolean(options.required);
  if (control.required) requiredMessage(control, "Silakan isi kolom ini.");
  control.maxLength = options.max ?? 2000;
  if (options.long) control.rows = 3;
  control.addEventListener("input", () => {
    update(control.value);
    dirty = true;
  });
  wrap.append(node("span", "", label), control);
  return wrap;
}

const photoPath = (value) => "/" + value.replace(/^\.\//, "");

function imagePicker(label, current, update, required = false) {
  const wrap = node("div", "field wide");
  const picker = node("label", "field");
  const select = node("select");
  select.required = required;
  if (required) requiredMessage(select, "Silakan pilih atau unggah foto.");
  select.append(new Option("Pilih foto", ""));
  for (const image of site.images) select.append(new Option(image.slice(7), image));
  select.value = current?.replace(/^\.\//, "") || "";
  const photo = node("img", "photo");
  photo.alt = "Pratinjau foto";
  function show(value) {
    photo.hidden = !value;
    if (value) photo.src = photoPath(value);
    else photo.removeAttribute("src");
  }
  show(select.value);
  select.addEventListener("change", () => {
    update(select.value);
    show(select.value);
    dirty = true;
  });
  picker.append(node("span", "", label), select);
  const file = node("input");
  file.type = "file";
  file.accept = "image/jpeg,image/png,image/webp";
  file.hidden = true;
  file.addEventListener("change", async () => {
    const image = file.files[0];
    if (!image || busy) return;
    if (image.size > 5 * 1024 * 1024) {
      notice("Foto maksimal 5 MB.", true);
      file.value = "";
      return;
    }
    busy = true;
    saveButton.disabled = true;
    try {
      const result = await api("/api/images", { method: "POST", body: image, headers: { "Content-Type": image.type } });
      site.images.push(result.image);
      update(result.image);
      dirty = true;
      render();
      notice("Foto sudah diunggah. Simpan perubahan untuk menampilkannya di situs.");
    } catch (error) {
      notice(error.message, true);
      file.value = "";
    } finally {
      busy = false;
      saveButton.disabled = false;
    }
  });
  const upload = button("Unggah foto", () => file.click(), "secondary upload");
  wrap.append(photo, picker, upload, file);
  return wrap;
}

function panel(title) {
  const item = node("div", "panel");
  item.append(node("h2", "", title));
  return item;
}

function renderProducts() {
  const list = node("div", "panel");
  const toolbar = node("div", "toolbar");
  toolbar.append(node("h2", "", `Katalog Produk (${products.length})`), button("+ Tambah produk", () => {
    products.push({ name: "", badge: "", description: "", image: "", alt: "" });
    dirty = true;
    render();
    editor.querySelector(".product:last-child input")?.focus();
  }));
  list.append(toolbar);
  if (!products.length) list.append(node("p", "hint", "Katalog kosong. Tambahkan produk untuk menampilkannya di situs."));
  products.forEach((product, index) => {
    const card = node("article", "product");
    const header = node("div", "product-header");
    const actions = node("div", "toolbar");
    function move(offset) {
      const position = index + offset;
      [products[index], products[position]] = [products[position], products[index]];
      dirty = true;
      render();
    }
    if (index > 0) actions.append(button("Naik", () => move(-1)));
    if (index < products.length - 1) actions.append(button("Turun", () => move(1)));
    actions.append(button("Hapus", () => {
      if (!window.confirm(`Hapus produk ${product.name || "baru"} dari draf?`)) return;
      products.splice(index, 1);
      dirty = true;
      render();
    }, "danger"));
    header.append(node("h3", "", product.name || "Produk baru"), actions);
    const fields = node("div", "fields");
    for (const [key, label, max] of [["name", "Nama produk", 100], ["badge", "Label produk", 60], ["description", "Deskripsi produk", 1800], ["alt", "Deskripsi foto (opsional)", 200]]) {
      fields.append(field(label, product[key], (value) => { product[key] = value; },
        { max, long: key === "description", required: key !== "alt" }));
    }
    fields.append(imagePicker("Foto produk", product.image, (value) => { product.image = value; }, true));
    card.append(header, fields);
    list.append(card);
  });
  return list;
}

function selectSection(id, force = false) {
  if (busy) return;
  if (!force && dirty && !window.confirm("Buang perubahan di bagian ini yang belum disimpan?")) return;
  selected = id;
  const section = site.sections.find((item) => item.id === selected);
  values = Object.fromEntries((section?.fields || []).map((entry) => [entry.id, entry.value]));
  products = site.products.map((product) => ({ ...product }));
  block = { title: "", body: "" };
  dirty = false;
  render();
}

function render() {
  const nav = get("sections");
  nav.replaceChildren();
  for (const section of site.sections) {
    const item = button(section.name, () => { if (selected !== section.id) { selectSection(section.id); notice(""); } });
    if (section.id === selected) item.setAttribute("aria-current", "true");
    nav.append(item);
  }
  editor.replaceChildren();
  const section = site.sections.find((item) => item.id === selected);
  get("section-title").textContent = section ? section.name : "Tambah bagian";
  if (!section) {
    const add = panel("Isi bagian baru");
    const fields = node("div", "fields");
    fields.append(
      field("Judul", block.title, (value) => { block.title = value; }, { max: 100, required: true }),
      field("Isi", block.body, (value) => { block.body = value; }, { long: true, required: true })
    );
    add.append(fields);
    editor.append(add);
    return;
  }
  if (selected === "produk") editor.append(renderProducts());
  const copy = panel(selected === "produk" ? "Pengantar Produk" : "Konten");
  const fields = node("div", "fields");
  for (const entry of section.fields) {
    const update = (value) => { values[entry.id] = value; };
    fields.append(entry.kind === "image"
      ? imagePicker(entry.label, values[entry.id], update, true)
      : field(entry.label, values[entry.id], update, { long: entry.kind === "long" || entry.value.length > 105 }));
  }
  copy.append(fields);
  if (section.canAdd) {
    const extra = node("details");
    extra.open = Boolean(block.title || block.body);
    extra.append(node("summary", "", "+ " + (section.addition?.label || "Tambah blok teks")));
    const fields = node("div", "fields");
    if (!section.addition || section.addition.heading) {
      fields.append(field(section.addition?.heading || "Judul blok (opsional)", block.title,
        (value) => { block.title = value; }, { max: 100 }));
    }
    fields.append(field("Isi", block.body, (value) => { block.body = value; }, { long: true }));
    extra.append(fields);
    copy.append(extra);
  }
  if (section.custom) {
    copy.append(button("Hapus bagian ini", () => {
      if (window.confirm(`Hapus bagian ${section.name} dari situs?`)) persist({ remove: true });
    }, "danger"));
  }
  editor.append(copy);
}

async function persist(extra) {
  if (busy) return;
  busy = true;
  saveButton.disabled = true;
  notice("Menyimpan…");
  try {
    const input = {
      revision: site.revision, section: selected, fields: values, products,
      ...(selected === "new" ? block : block.title || block.body ? { block } : {}),
      ...extra
    };
    site = await api("/api/site", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const next = selected === "new" ? site.sections.filter((item) => item.custom).at(-1)?.id : selected;
    busy = false;
    selectSection(site.sections.some((item) => item.id === next) ? next : "produk", true);
    notice("Perubahan tersimpan di situs lokal.");
  } catch (error) {
    notice(error.message, true);
  } finally {
    busy = false;
    saveButton.disabled = false;
  }
}

const loginInput = get("access-code");
const loginSubmit = get("login-submit");
const passwordForm = get("password-form");
const passwordPanel = get("password-panel");
const passwordSettings = get("password-settings");
const currentPassword = get("current-password");
const newPassword = get("new-password");
const confirmPassword = get("confirm-password");
const passwordStatus = get("password-status");
const passwordSubmit = get("save-password");

function setPasswordMode(configured) {
  passwordConfigured = configured;
  get("access-label").textContent = configured ? "Kata sandi" : "Kode akses";
  get("login-description").textContent = configured
    ? "Masukkan kata sandi yang Anda buat."
    : "Masukkan kode akses dari terminal untuk masuk dan membuat kata sandi.";
  loginInput.autocomplete = configured ? "current-password" : "off";
  currentPassword.disabled = !configured;
  currentPassword.required = configured;
  get("current-password-field").hidden = !configured;
  passwordSettings.textContent = configured ? "Ubah kata sandi" : "Atur kata sandi";
}

api("/api/auth/status").then(({ passwordConfigured, passwordLength }) => {
  setPasswordMode(passwordConfigured);
  get("password-hint").textContent = passwordLength
    ? `Gunakan ${passwordLength.min}–${passwordLength.max} karakter.`
    : "Mulai ulang dashboard untuk memuat aturan kata sandi terbaru.";
  loginSubmit.disabled = false;
}).catch((error) => {
  get("login-status").textContent = error.message;
});

get("access-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (loginSubmit.disabled) return;
  loginSubmit.disabled = true;
  get("login-status").textContent = "";
  try {
    if (passwordConfigured) {
      const result = await api("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: loginInput.value })
      });
      code = result.token;
    } else {
      code = loginInput.value.trim();
    }
    site = await api("/api/site");
    loginInput.value = "";
    get("login").hidden = true;
    get("dashboard").hidden = false;
    passwordSettings.hidden = false;
    selectSection(selected, true);
  } catch (error) {
    code = "";
    get("login-status").textContent = error.message;
  } finally {
    loginSubmit.disabled = false;
  }
});
requiredMessage(loginInput, "Silakan isi kode akses atau kata sandi.");
for (const field of [currentPassword, newPassword, confirmPassword]) requiredMessage(field, "Silakan isi kata sandi.");

passwordSettings.addEventListener("click", () => {
  if (passwordSubmit.disabled) return;
  const opening = passwordPanel.hidden;
  passwordForm.reset();
  for (const field of [currentPassword, newPassword, confirmPassword]) field.setCustomValidity("");
  passwordStatus.textContent = "";
  passwordPanel.hidden = !opening;
  passwordSettings.setAttribute("aria-expanded", String(opening));
  if (opening) (passwordConfigured ? currentPassword : newPassword).focus();
});

passwordForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (passwordSubmit.disabled) return;
  passwordStatus.classList.add("error");
  if (newPassword.value !== confirmPassword.value) {
    passwordStatus.textContent = "Kata sandi baru dan ulangannya harus sama.";
    confirmPassword.focus();
    return;
  }
  passwordSubmit.disabled = true;
  passwordStatus.textContent = "";
  try {
    const result = await api("/api/auth/password", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPassword.value, newPassword: newPassword.value })
    });
    code = result.token;
    setPasswordMode(true);
    passwordForm.reset();
    passwordStatus.classList.remove("error");
    passwordStatus.textContent = "Kata sandi tersimpan.";
  } catch (error) {
    passwordStatus.textContent = error.message;
  } finally {
    passwordSubmit.disabled = false;
  }
});

get("new-section").addEventListener("click", () => {
  if (selected !== "new") selectSection("new");
});
editor.addEventListener("submit", (event) => {
  event.preventDefault();
  persist();
});
window.addEventListener("beforeunload", (event) => {
  if (dirty) event.preventDefault();
});
