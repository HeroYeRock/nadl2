const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

// macOS 외장드라이브에서 자동 생성되는 AppleDouble (._*) 메타파일 무시
config.resolver.blockList = [/(^|\/)\._.*/];

module.exports = config;
