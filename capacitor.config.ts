import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lamce.pizzaDayApp',
  appName: 'PizzaDay',
  webDir: 'www',
  
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#f59e0b",
      showSpinner: false,
      androidSpinnerStyle: "small",
      iosSpinnerStyle: "small",
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;