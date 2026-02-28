module.exports = function (api) {
  api.cache.using(() => process.env.NODE_ENV || 'development');
  return {
    presets: ['babel-preset-expo'],
  };
};
