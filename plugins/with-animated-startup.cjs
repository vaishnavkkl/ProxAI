const { withBaseMod } = require('expo/config-plugins');

// React owns the animated startup screen. Keep only the matching background
// while the runtime starts, without Android's static app logo.
module.exports = function withAnimatedStartup(config) {
  return withBaseMod(config, {
    platform: 'android',
    mod: 'styles',
    async action(config) {
      // Run Expo's style generation first so it cannot restore the static logo.
      config = await config.modRequest.nextMod(config);
      const splash = config.modResults.resources.style?.find(
        (style) => style.$.name === 'Theme.App.SplashScreen',
      );
      if (!splash) throw new Error('Apply with-animated-startup after expo-splash-screen.');
      splash.item = (splash.item || []).filter((item) =>
        !['windowSplashScreenAnimatedIcon', 'android:windowSplashScreenBehavior'].includes(item.$.name));
      splash.item.push({ $: { name: 'windowSplashScreenAnimatedIcon' }, _: '@android:color/transparent' });
      return config;
    },
  });
};
