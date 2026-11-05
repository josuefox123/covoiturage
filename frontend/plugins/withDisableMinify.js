const { withGradleProperties } = require('expo/config-plugins');

module.exports = function withDisableMinify(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter(
      (item) => item.type !== 'property' || (
        item.key !== 'android.enableMinifyInReleaseBuilds' &&
        item.key !== 'android.enableShrinkResourcesInReleaseBuilds'
      )
    );
    config.modResults.push({
      type: 'property',
      key: 'android.enableMinifyInReleaseBuilds',
      value: 'false',
    });
    config.modResults.push({
      type: 'property',
      key: 'android.enableShrinkResourcesInReleaseBuilds',
      value: 'false',
    });
    return config;
  });
};
