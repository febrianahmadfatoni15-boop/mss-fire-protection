import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const settings = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const passwordLength = { min: 8, max: 16 };
const makeToken = () => randomBytes(24).toString("hex");
const hashPassword = (password, salt) => scryptSync(password, salt, 32, settings);

function reject(status, message) {
  throw Object.assign(new Error(message), { status });
}

function same(left, right) {
  const first = Buffer.from(left);
  const second = Buffer.from(right);
  return first.length === second.length && timingSafeEqual(first, second);
}

export function createAdminAuth() {
  const profile = process.platform === "win32"
    ? process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local")
    : join(homedir(), ".config");
  const directory = resolve(process.env.MSS_ADMIN_AUTH_DIR || join(profile, "MSS Fire Protection"));
  const path = join(directory, "admin-auth.json");
  const setupCode = makeToken();
  let session = makeToken();
  let activeHash = null;
  let failedAttempts = 0;
  let retryAt = 0;

  function readRecord() {
    let record;
    try {
      record = JSON.parse(readFileSync(path, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    if (record?.version !== 1 || typeof record.salt !== "string" || !/^[a-f0-9]{32}$/.test(record.salt)
        || typeof record.hash !== "string" || !/^[a-f0-9]{64}$/.test(record.hash)) {
      throw new Error("File kata sandi dashboard tidak valid.");
    }
    return record;
  }

  function authorize(header, record = readRecord()) {
    const supplied = header || "";
    const permitted = record
      ? activeHash === record.hash && same(supplied, "Bearer " + session)
      : same(supplied, "Bearer " + setupCode);
    if (!permitted) reject(401, "Sesi admin tidak valid. Muat ulang halaman dan masuk kembali.");
  }

  function verify(password, record) {
    const now = Date.now();
    if (now >= retryAt) failedAttempts = 0;
    if (failedAttempts >= 5) reject(429, "Terlalu banyak percobaan. Tunggu satu menit lalu coba lagi.");
    const matches = typeof password === "string" && password.length > 0 && password.length <= 256
      && timingSafeEqual(hashPassword(password, Buffer.from(record.salt, "hex")), Buffer.from(record.hash, "hex"));
    if (!matches) {
      if (failedAttempts === 0) retryAt = now + 60_000;
      failedAttempts++;
      reject(401, "Kata sandi salah.");
    }
    failedAttempts = 0;
  }

  return {
    setupCode,
    status: () => ({ passwordConfigured: Boolean(readRecord()), passwordLength }),
    authorize,
    login(password) {
      const record = readRecord();
      if (!record) reject(409, "Masuk dengan kode akses dari terminal untuk membuat kata sandi.");
      verify(password, record);
      activeHash = record.hash;
      return { token: session };
    },
    setPassword(header, input) {
      const record = readRecord();
      authorize(header, record);
      const password = input?.newPassword;
      const length = typeof password === "string" ? [...password].length : 0;
      if (length < passwordLength.min || length > passwordLength.max || !password.trim()) {
        reject(400, `Kata sandi harus berisi ${passwordLength.min}–${passwordLength.max} karakter.`);
      }
      if (record) verify(input.currentPassword, record);

      const salt = randomBytes(16);
      const hash = hashPassword(password, salt).toString("hex");
      const temporary = join(directory, randomUUID() + ".tmp");
      mkdirSync(directory, { recursive: true, mode: 0o700 });
      try {
        writeFileSync(temporary, JSON.stringify({ version: 1, salt: salt.toString("hex"), hash }), { flag: "wx", mode: 0o600 });
        renameSync(temporary, path);
      } finally {
        rmSync(temporary, { force: true });
      }

      activeHash = hash;
      session = makeToken();
      return { token: session };
    }
  };
}
