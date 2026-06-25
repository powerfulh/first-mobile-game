# 릴리스: www→android 동기화 + 버전 적용 + 커밋 한 번에
# 사용법: powershell -ExecutionPolicy Bypass -File tools/release.ps1 1.4.2
#   versionName 은 인자로 받고, versionCode 는 현재값 +1 자동 증가

param(
    [Parameter(Mandatory = $true)]
    [string]$VersionName
)

$ErrorActionPreference = "Stop"

# 버전 형식 검증 (x.y.z)
if ($VersionName -notmatch '^\d+\.\d+\.\d+$') {
    Write-Error "버전 형식 오류: '$VersionName' (예: 1.4.2)"
    exit 1
}

# 리포 루트 = 이 스크립트(tools/)의 상위 폴더
$root = Split-Path -Parent $PSScriptRoot
$gradle = Join-Path $root "android\app\build.gradle"

# 1) PATH 갱신 후 동기화 (sync.ps1 과 동일 로직)
$env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path", "User")
npx.cmd cap copy android
if ($LASTEXITCODE -ne 0) { Write-Error "cap copy android 실패"; exit 1 }

# 2) build.gradle 버전 적용 (UTF-8 no BOM 유지)
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
$content = [System.IO.File]::ReadAllText($gradle)

if ($content -notmatch 'versionCode\s+(\d+)') { Write-Error "versionCode 를 찾지 못함"; exit 1 }
$oldCode = [int]$Matches[1]
$newCode = $oldCode + 1

if ($content -notmatch 'versionName\s+"([^"]+)"') { Write-Error "versionName 을 찾지 못함"; exit 1 }
$oldName = $Matches[1]

$content = $content -replace "versionCode\s+$oldCode", "versionCode $newCode"
$content = $content -replace "versionName\s+`"$([regex]::Escape($oldName))`"", "versionName `"$VersionName`""

[System.IO.File]::WriteAllText($gradle, $content, $utf8NoBom)
Write-Host "버전 적용: $oldName -> $VersionName (versionCode $oldCode -> $newCode)"

# 3) 커밋
git -C $root add -A
git -C $root commit -m "$VersionName (versionCode $newCode)"
