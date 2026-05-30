const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withApkSplit(config) {
  return withAppBuildGradle(config, config => {
    if (config.modResults.language === 'groovy') {
      if (!config.modResults.contents.includes('splits {')) {
        config.modResults.contents = config.modResults.contents.replace(
          /android\s*\{/,
          `android {
    splits {
        abi {
            reset()
            enable true
            universalApk false
            include "armeabi-v7a", "arm64-v8a", "x86", "x86_64"
        }
    }`
        );
      }
    }
    return config;
  });
};
