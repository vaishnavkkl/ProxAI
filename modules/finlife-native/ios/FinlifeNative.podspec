Pod::Spec.new do |s|
  s.name           = 'FinlifeNative'
  s.version        = '1.0.0'
  s.summary        = 'Device memory and Android SMS helpers for FinLife'
  s.description    = 'Device memory and Android SMS helpers for FinLife'
  s.author         = 'FinLife'
  s.homepage       = 'https://docs.expo.dev'
  s.license        = 'MIT'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES'
  }
end
