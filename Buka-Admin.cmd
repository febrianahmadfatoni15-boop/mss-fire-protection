@echo off
setlocal
title MSS Fire Protection - Dashboard Admin
cd /d "%~dp0" || goto :gagal

where node.exe >nul 2>&1
if errorlevel 1 (
  echo Node.js belum ditemukan. Pasang Node.js versi 22 atau lebih baru.
  goto :gagal
)

if not exist "node_modules\parse5\package.json" (
  echo Memasang dependensi dashboard...
  call npm.cmd ci --no-fund
  if errorlevel 1 goto :gagal
)

echo Jangan tutup jendela ini selama menggunakan dashboard.
echo Masuk dengan kata sandi Anda atau kode akses saat pengaturan pertama.
echo.
node admin\server.mjs --open
if errorlevel 1 goto :gagal
exit /b 0

:gagal
echo.
echo Dashboard tidak dapat dijalankan. Periksa pesan di atas.
pause
exit /b 1
