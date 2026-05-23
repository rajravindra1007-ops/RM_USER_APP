# ============================================================
#  RMGames — Android Release Deploy Script
#  Usage: .\deploy-rmgames.ps1
#  Run from: C:\RM Projects\User-app\
# ============================================================

param(
    [string]$VPS_HOST    = "187.127.159.19",
    [string]$VPS_USER    = "root",
    [string]$VPS_PATH    = "/var/www/rmgames.live/downloads",
    [string]$APK_RENAME  = "rmgames.apk"
)

# ── Colors ───────────────────────────────────────────────────
function Log-Step  { param($msg) Write-Host "`n▶  $msg" -ForegroundColor Cyan }
function Log-OK    { param($msg) Write-Host "  ✅ $msg" -ForegroundColor Green }
function Log-Error { param($msg) Write-Host "  ❌ $msg" -ForegroundColor Red; exit 1 }
function Log-Info  { param($msg) Write-Host "  ℹ  $msg" -ForegroundColor Yellow }

Clear-Host
Write-Host "============================================" -ForegroundColor Magenta
Write-Host "   RMGames Android Release Deploy Tool     " -ForegroundColor Magenta
Write-Host "============================================" -ForegroundColor Magenta

# ── STEP 0 — Verify we are in the right folder ───────────────
Log-Step "Checking project directory..."

$GRADLE_FILE = "android\app\build.gradle"
if (-not (Test-Path $GRADLE_FILE)) {
    Log-Error "build.gradle not found. Run this script from: C:\RM Projects\User-app\"
}
Log-OK "Project directory confirmed"

# ── STEP 1 — Read current version ────────────────────────────
Log-Step "Reading current version from build.gradle..."

$gradleContent = Get-Content $GRADLE_FILE -Raw
$versionCodeMatch = [regex]::Match($gradleContent, 'versionCode\s+(\d+)')
$versionNameMatch = [regex]::Match($gradleContent, 'versionName\s+"([^"]+)"')

if (-not $versionCodeMatch.Success -or -not $versionNameMatch.Success) {
    Log-Error "Could not parse versionCode or versionName from build.gradle"
}

$currentCode = [int]$versionCodeMatch.Groups[1].Value
$currentName = $versionNameMatch.Groups[1].Value

Log-OK "Current versionCode : $currentCode"
Log-OK "Current versionName : $currentName"

# ── STEP 2 — Ask for new version ─────────────────────────────
Log-Step "Enter new version details..."

$newCode = Read-Host "  Enter new versionCode (current: $currentCode, press Enter to auto-increment)"
if ([string]::IsNullOrWhiteSpace($newCode)) {
    $newCode = $currentCode + 1
} else {
    $newCode = [int]$newCode
}

$newName = Read-Host "  Enter new versionName (current: $currentName, press Enter to keep)"
if ([string]::IsNullOrWhiteSpace($newName)) {
    $newName = $currentName
}

Log-Info "New versionCode : $newCode"
Log-Info "New versionName : $newName"

$confirm = Read-Host "`n  Confirm version update? (y/n)"
if ($confirm -ne 'y' -and $confirm -ne 'Y') {
    Write-Host "`n  Cancelled." -ForegroundColor Yellow
    exit 0
}

# ── STEP 3 — Update build.gradle ─────────────────────────────
Log-Step "Updating android\app\build.gradle..."

$gradleContent = $gradleContent -replace 'versionCode\s+\d+', "versionCode $newCode"
$gradleContent = $gradleContent -replace 'versionName\s+"[^"]+"', "versionName `"$newName`""

Set-Content -Path $GRADLE_FILE -Value $gradleContent -NoNewline
Log-OK "build.gradle updated → versionCode $newCode, versionName $newName"

# ── STEP 4 — Build release APK ───────────────────────────────
Log-Step "Building release APK (this takes 2-5 minutes)..."

$buildStart = Get-Date
Push-Location "android"

try {
    & cmd /c "gradlew.bat assembleRelease 2>&1"
    if ($LASTEXITCODE -ne 0) {
        Pop-Location
        Log-Error "Gradle build failed! Check errors above."
    }
} catch {
    Pop-Location
    Log-Error "Gradle command failed: $_"
}

Pop-Location

$buildEnd  = Get-Date
$buildTime = [math]::Round(($buildEnd - $buildStart).TotalSeconds)
Log-OK "Build completed in ${buildTime}s"

# ── STEP 5 — Find and rename APK ─────────────────────────────
Log-Step "Locating and renaming APK..."

$APK_DIR = "android\app\build\outputs\apk\release"
$apkFiles = Get-ChildItem -Path $APK_DIR -Filter "*.apk" | Sort-Object LastWriteTime -Descending

if ($apkFiles.Count -eq 0) {
    Log-Error "No APK found in $APK_DIR"
}

$sourceApk   = $apkFiles[0].FullName
$renamedApk  = Join-Path $APK_DIR $APK_RENAME
$versionedApk = Join-Path $APK_DIR "rmgames-v$newName.apk"

Copy-Item -Path $sourceApk -Destination $renamedApk   -Force
Copy-Item -Path $sourceApk -Destination $versionedApk -Force

Log-OK "APK found    : $($apkFiles[0].Name)"
Log-OK "Renamed to   : $APK_RENAME"
Log-OK "Versioned as : rmgames-v$newName.apk"

# ── STEP 6 — Upload to VPS ───────────────────────────────────
Log-Step "Uploading APK to VPS ($VPS_HOST)..."

# Check if scp is available
$scpAvailable = Get-Command scp -ErrorAction SilentlyContinue
if (-not $scpAvailable) {
    Log-Error "scp not found. Install OpenSSH: Settings → Apps → Optional Features → OpenSSH Client"
}

# Delete old APKs on VPS
Log-Info "Deleting old APKs from VPS..."
& ssh "${VPS_USER}@${VPS_HOST}" "rm -f ${VPS_PATH}/*.apk"
if ($LASTEXITCODE -ne 0) {
    Log-Error "Failed to connect to VPS. Check SSH key setup."
}
Log-OK "Old APKs deleted from VPS"

# Upload renamed APK
Log-Info "Uploading $APK_RENAME to VPS..."
& scp $renamedApk "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/${APK_RENAME}"
if ($LASTEXITCODE -ne 0) {
    Log-Error "SCP upload failed!"
}

# Upload versioned APK
Log-Info "Uploading versioned APK..."
& scp $versionedApk "${VPS_USER}@${VPS_HOST}:${VPS_PATH}/rmgames-v${newName}.apk"

Log-OK "APK uploaded to VPS successfully"

# ── STEP 7 — Verify on VPS ───────────────────────────────────
Log-Step "Verifying upload on VPS..."

$remoteFiles = & ssh "${VPS_USER}@${VPS_HOST}" "ls -lh ${VPS_PATH}/*.apk 2>/dev/null"
Log-OK "Files on VPS:"
Write-Host $remoteFiles -ForegroundColor Gray

# ── DONE ─────────────────────────────────────────────────────
Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "   DEPLOY COMPLETE!                        " -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Version    : v$newName (code: $newCode)" -ForegroundColor White
Write-Host "  APK URL    : https://rmgames.live/downloads/$APK_RENAME" -ForegroundColor White
Write-Host "  VPS Path   : ${VPS_PATH}" -ForegroundColor White
Write-Host ""
