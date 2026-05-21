const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// macOS 외장드라이브에서 자동 생성되는 AppleDouble (._*) 메타파일 무시
config.resolver.blockList = [/(^|\/)\._.*/];

// Supabase JS 가 가져오는 @opentelemetry/api 의 dynamic import 가
// Hermes 컴파일러를 깨뜨려서 stub 모듈로 대체.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@opentelemetry/api") {
    return {
      type: "sourceFile",
      filePath: path.resolve(__dirname, "stubs/opentelemetry-api.js"),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
