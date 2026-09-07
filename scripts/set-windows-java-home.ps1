$javaHome = 'C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot'
$androidHome = 'C:\Users\Admin\AppData\Local\Android\Sdk'
$jdkBin = Join-Path $javaHome 'bin'

[Environment]::SetEnvironmentVariable('JAVA_HOME', $javaHome, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_HOME', $androidHome, 'User')
[Environment]::SetEnvironmentVariable('ANDROID_SDK_ROOT', $androidHome, 'User')

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ([string]::IsNullOrEmpty($userPath)) {
  $userPath = ''
}
if ($userPath -notlike "*${jdkBin}*") {
  [Environment]::SetEnvironmentVariable('Path', "$jdkBin;$userPath", 'User')
}

Write-Output "JAVA_HOME=$([Environment]::GetEnvironmentVariable('JAVA_HOME', 'User'))"
Write-Output "ANDROID_HOME=$([Environment]::GetEnvironmentVariable('ANDROID_HOME', 'User'))"
