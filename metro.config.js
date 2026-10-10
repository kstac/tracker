const {getDefaultConfig} = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's web build ships its engine as a .wasm file and needs SharedArrayBuffer, which browsers only allow on cross-origin isolated pages.
config.resolver.assetExts.push('wasm');
config.server.enhanceMiddleware = (middleware) => (req, res, next) => {
  res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  middleware(req, res, next);
};

module.exports = config;
