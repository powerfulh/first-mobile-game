# www/ → android/app/src/main/assets/public/ 동기화
# 사용법: powershell -ExecutionPolicy Bypass -File tools/sync.ps1

$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
npx.cmd cap copy android
