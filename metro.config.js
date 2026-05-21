const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// macOS 외장드라이브에서 자동 생성되는 AppleDouble (._*) 메타파일 무시
config.resolver.blockList = [/(^|\/)\._.*/];

// Supabase JS 가 옵션으로 끌어오는 @opentelemetry/api 의 dynamic import 가
// Hermes 컴파일러를 깨뜨려서 비활성화. RN 에서는 trace/telemetry 어차피 안 씀.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
