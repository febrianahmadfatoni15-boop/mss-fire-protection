import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { imagePath, readSite, revision, updateSite } from "./content.mjs";
import { createAdminAuth } from "./auth.mjs";

const directory = dirname(fileURLToPath(import.meta.url));
const root = dirname(directory);
const siteFile = join(root, "index.html");
const backupDirectory = join(root, ".admin-backups");
const port = Number(process.env.MSS_ADMIN_PORT ?? 4173);
const auth = createAdminAuth();
const files = new Map([
  ["/admin/", [join(directory, "index.html"), "text/html; charset=utf-8"]],
  ["/admin/admin.css", [join(directory, "admin.css"), "text/css; charset=utf-8"]],
  ["/admin/app.js", [join(directory, "app.js"), "text/javascript; charset=utf-8"]],
  ["/", [siteFile, "text/html; charset=utf-8"]],
  ["/index.html", [siteFile, "text/html; charset=utf-8"]],
  ["/css/style.css", [join(root, "css", "style.css"), "text/css; charset=utf-8"]],
  ["/js/main.js", [join(root, "js", "main.js"), "text/javascript; charset=utf-8"]],
  ["/fonts/inter-latin.woff2", [join(root, "fonts", "inter-latin.woff2"), "font/woff2"]]
]);
const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
const maxImage = 5 * 1024 * 1024;

function response(res, status, data, type = "application/json; charset=utf-8") {
  res.writeHead(status, { "Content-Type": type });
  res.end(type.startsWith("application/json") ? JSON.stringify(data) : data);
}

function reject(status, message) {
  throw Object.assign(new Error(message), { status });
}

async function readBody(req, limit) {
  const parts = [];
  let size = 0;
  for await (const part of req.iterator({ destroyOnReturn: false })) {
    size += part.length;
    if (size > limit) {
      req.resume();
      reject(413, "Ukuran file atau data melebihi batas.");
    }
    parts.push(part);
  }
  return Buffer.concat(parts, size);
}

async function readJson(req, limit) {
  if (req.headers["content-type"]?.split(";")[0] !== "application/json") reject(415, "Gunakan format JSON.");
  const bytes = await readBody(req, limit);
  try {
    return JSON.parse(bytes.toString("utf8"));
  } catch {
    reject(400, "Data tidak bisa dibaca.");
  }
}

function images() {
  return readdirSync(join(root, "images"), { withFileTypes: true })
    .filter((entry) => entry.isFile() && imagePath("images/" + entry.name))
    .map((entry) => "images/" + entry.name);
}

function imageExtension(bytes) {
  if (bytes.length < 16) return null;
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
      && bytes.subarray(12, 16).toString() === "IHDR") return ".png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
      && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9) return ".jpg";
  if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP"
      && bytes.readUInt32LE(4) + 8 === bytes.length) return ".webp";
  return null;
}

function saveSite(original, updated) {
  if (original === updated) return;
  mkdirSync(backupDirectory, { recursive: true });
  const id = randomUUID();
  const backup = join(backupDirectory, new Date().toISOString().replace(/[:.]/g, "-") + "-" + id + ".html");
  const temporary = join(root, id + ".admin-tmp");
  writeFileSync(backup, original, { flag: "wx" });
  writeFileSync(temporary, updated, { flag: "wx" });
  try {
    renameSync(temporary, siteFile);
  } catch (error) {
    unlinkSync(temporary);
    throw error;
  }
}

function headers(res) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
}

const server = createServer({ requestTimeout: 15000 }, async (req, res) => {
  headers(res);
  const hostname = "127.0.0.1:" + server.address().port;
  try {
    if (req.headers.host !== hostname) reject(403, "Akses hanya melalui alamat lokal dashboard.");
    const url = new URL(req.url, "http://" + hostname);
    const pathname = decodeURIComponent(url.pathname);
    if (pathname.startsWith("/api/")) {
      if (req.headers.origin && req.headers.origin !== "http://" + hostname) reject(403, "Asal permintaan tidak diizinkan.");
      if (req.headers["sec-fetch-site"] === "cross-site") reject(403, "Asal permintaan tidak diizinkan.");
      if (req.method === "GET" && pathname === "/api/auth/status") {
        return response(res, 200, auth.status());
      }
      if (req.method === "POST" && pathname === "/api/auth/login") {
        const input = await readJson(req, 4096);
        return response(res, 200, auth.login(input?.password));
      }
      auth.authorize(req.headers.authorization);
      if (req.method === "PUT" && pathname === "/api/auth/password") {
        const input = await readJson(req, 4096);
        return response(res, 200, auth.setPassword(req.headers.authorization, input));
      }
      if (req.method === "GET" && pathname === "/api/site") {
        return response(res, 200, { ...readSite(readFileSync(siteFile, "utf8")), images: images() });
      }
      if (req.method === "PUT" && pathname === "/api/site") {
        const input = await readJson(req, 768 * 1024);
        auth.authorize(req.headers.authorization);
        const original = readFileSync(siteFile, "utf8");
        if (!input || !(typeof input.revision === "string") || revision(original) !== input.revision) {
          reject(409, "Halaman telah berubah. Muat ulang dashboard sebelum menyimpan.");
        }
        const available = images();
        const updated = updateSite(original, input, new Set(available));
        const data = readSite(updated);
        saveSite(original, updated);
        return response(res, 200, { ...data, images: available });
      }
      if (req.method === "POST" && pathname === "/api/images") {
        if (!["image/png", "image/jpeg", "image/webp"].includes(req.headers["content-type"])) {
          reject(415, "Gunakan foto JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.");
        }
        const bytes = await readBody(req, maxImage);
        auth.authorize(req.headers.authorization);
        const extension = imageExtension(bytes);
        if (!extension || mime[extension] !== req.headers["content-type"]) reject(415, "Format file tidak sesuai dengan isi gambar.");
        const name = "unggahan-" + randomUUID() + extension;
        writeFileSync(join(root, "images", name), bytes, { flag: "wx" });
        return response(res, 201, { image: "images/" + name });
      }
      reject(404, "API tidak ditemukan.");
    }
    if (req.method !== "GET") reject(405, "Metode tidak diizinkan.");
    if (pathname === "/admin") {
      res.writeHead(302, { Location: "/admin/" });
      return res.end();
    }
    if (pathname.startsWith("/admin/")) {
      res.setHeader("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; require-trusted-types-for 'script'; trusted-types 'none'");
    }
    const image = pathname.slice(1);
    const file = files.get(pathname) || (imagePath(image) && images().includes(image)
      ? [join(root, image), mime[extname(image).toLowerCase()]] : null);
    if (!file) reject(404, "Halaman tidak ditemukan.");
    return response(res, 200, readFileSync(file[0]), file[1]);
  } catch (error) {
    const status = error.status || (error instanceof URIError ? 400 : 500);
    if (status === 500) console.error(error);
    if (!res.headersSent) response(res, status, { error: status === 500 ? "Perubahan gagal. Periksa terminal dashboard." : error.message });
  }
});

server.on("error", (error) => {
  console.error(error.code === "EADDRINUSE" ? "Port dashboard sedang dipakai. Tutup dashboard lain atau atur MSS_ADMIN_PORT." : error.message);
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  const url = "http://127.0.0.1:" + server.address().port + "/admin/";
  console.log("Dashboard: " + url);
  try {
    console.log(auth.status().passwordConfigured
      ? "Masuk dengan kata sandi dashboard Anda."
      : "Kode akses sesi: " + auth.setupCode);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    server.close();
    return;
  }
  if (process.argv.includes("--open") && process.platform === "win32") {
    execFile("rundll32.exe", ["url.dll,FileProtocolHandler", url], { windowsHide: true }, (error) => {
      if (error) console.log("Buka alamat dashboard di atas secara manual.");
    });
  }
});
