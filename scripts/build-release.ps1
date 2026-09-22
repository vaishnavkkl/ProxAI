param(
    [string]$Architecture = 'arm64-v8a',
    [string]$GradleCache = "$env:USERPROFILE/.gradle"
)
$ErrorActionPreference = 'Stop'
$projectPath = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$androidPath = Join-Path $projectPath 'android'
$signingPath = Join-Path $projectPath '.local-signing'
$keyPath = Join-Path $signingPath 'proxai-release.p12'
$credentialsPath = Join-Path $signingPath 'release.properties'
$utf8 = New-Object Text.UTF8Encoding($false)

if (!(Test-Path -LiteralPath "$androidPath/gradlew.bat")) { throw 'The local android project is missing.' }
if (!$env:JAVA_HOME) { throw 'Set JAVA_HOME to your installed JDK 21.' }
$keytool = Join-Path $env:JAVA_HOME 'bin/keytool.exe'
if (!(Test-Path -LiteralPath $keytool)) { throw 'keytool was not found in JAVA_HOME.' }

if (!(Test-Path -LiteralPath $keyPath) -and !(Test-Path -LiteralPath $credentialsPath)) {
    New-Item -ItemType Directory -Force -Path $signingPath | Out-Null
    $bytes = New-Object byte[] 32
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    $password = [Convert]::ToBase64String($bytes)
    $env:PROXAI_LOCAL_SIGNING_PASSWORD = $password
    try {
        & $keytool -genkeypair -noprompt -storetype PKCS12 -keystore $keyPath `
          -alias proxai-release -keyalg RSA -keysize 4096 -validity 10000 `
          -dname 'CN=ProxAI, OU=Mobile, O=ProxAI, C=IN' `
          -storepass:env PROXAI_LOCAL_SIGNING_PASSWORD -keypass:env PROXAI_LOCAL_SIGNING_PASSWORD
        if ($LASTEXITCODE -ne 0) { throw 'Could not generate the release keystore.' }
        $properties = "storeFile=../.local-signing/proxai-release.p12`nstorePassword=$password`nkeyAlias=proxai-release`nkeyPassword=$password`n"
        [IO.File]::WriteAllText($credentialsPath, $properties, $utf8)
    } finally {
        Remove-Item Env:PROXAI_LOCAL_SIGNING_PASSWORD -ErrorAction SilentlyContinue
        $password = $null
        $properties = $null
    }
    Write-Host 'Created a new local release keystore. Credentials are in .local-signing (gitignored).'
} elseif (!(Test-Path -LiteralPath $keyPath) -or !(Test-Path -LiteralPath $credentialsPath)) {
    throw 'Only part of the signing pair exists. Restore the matching key and credentials; they will not be overwritten.'
} else {
    Write-Host 'Reusing the existing local release keystore.'
}

# Reapply signing if the generated Android project has been recreated.
$buildFile = Join-Path $androidPath 'app/build.gradle'
$buildText = [IO.File]::ReadAllText($buildFile)
$signingLine = 'apply from: rootProject.file("../scripts/release-signing.gradle")'
if (!$buildText.Contains($signingLine)) {
    [IO.File]::WriteAllText($buildFile, $buildText + "`n" + $signingLine + "`n", $utf8)
}

$sdkPath = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android/Sdk' }
$env:ANDROID_HOME = $sdkPath
$env:ANDROID_SDK_ROOT = $sdkPath
$env:NODE_ENV = 'production'
$env:EXPO_NO_TELEMETRY = '1'
Push-Location $androidPath
try {
    & .\gradlew.bat -g $GradleCache :app:assembleRelease :app:bundleRelease `
      "-PreactNativeArchitectures=$Architecture" --max-workers=2 --console=plain
    if ($LASTEXITCODE -ne 0) { throw 'Local Android release build failed.' }
} finally { Pop-Location }

$buildTools = Get-ChildItem -LiteralPath (Join-Path $sdkPath 'build-tools') -Directory |
    Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'apksigner.bat') } |
    Sort-Object Name -Descending | Select-Object -First 1
if (!$buildTools) { throw 'Android apksigner was not found.' }
$apk = Join-Path $androidPath 'app/build/outputs/apk/release/app-release.apk'
& (Join-Path $buildTools.FullName 'apksigner.bat') verify --verbose --print-certs $apk
if ($LASTEXITCODE -ne 0) { throw 'APK signature verification failed.' }

$releasePath = Join-Path $projectPath 'releases'
New-Item -ItemType Directory -Force -Path $releasePath | Out-Null
$version = (Get-Content -LiteralPath (Join-Path $projectPath 'app.json') -Raw | ConvertFrom-Json).expo.version
$baseName = "ProxAI-$version-$Architecture-release"
Copy-Item -LiteralPath $apk -Destination (Join-Path $releasePath "$baseName.apk") -Force
Copy-Item -LiteralPath (Join-Path $androidPath 'app/build/outputs/bundle/release/app-release.aab') -Destination (Join-Path $releasePath "$baseName.aab") -Force
$checksums = Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $releasePath "$baseName.apk"), (Join-Path $releasePath "$baseName.aab") |
    ForEach-Object { "$($_.Hash.ToLower())  $([IO.Path]::GetFileName($_.Path))" }
[IO.File]::WriteAllLines((Join-Path $releasePath 'SHA256SUMS.txt'), $checksums, $utf8)
Write-Host "Signed release files: $releasePath"
