// Static web rendering can't bundle expo-sqlite's web worker, so local web previews opt into single-page mode.
module.exports = ({config}) =>
  process.env.WEB_SPA ? {...config, web: {...config.web, output: 'single'}} : config;
