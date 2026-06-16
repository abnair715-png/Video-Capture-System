This is an Android-focused [React Native](https://reactnative.dev) project bootstrapped with [`@react-native-community/cli`](https://github.com/react-native-community/cli).

## What’s included

- TypeScript app shell
- React Navigation with native stack
- Android API 29+ baseline
- Clean `src/` folder structure
- Service-first layout for future business logic

## Folder structure

```text
src/
  components/
  config/
  constants/
  db/
  hooks/
  models/
  screens/
  services/
  types/
  utils/
```

## Install dependencies

From `VideoCaptureSystem/`:

```sh
npm install
```

## Run Android

In one terminal, start Metro:

```sh
npm start
```

In a second terminal, build and launch Android:

```sh
npm run android
```

## Notes

- React Navigation is wired through `src/config/navigation/AppNavigator.tsx`
- `react-native-gesture-handler` is loaded from `index.js`
- `react-native-screens` is enabled in `src/App.tsx`
- The Android manifest opts out of predictive back for compatibility with the navigation stack
- Mock auth credentials: `admin@test.com` / `123456`
- Successful login stores a secure session with `react-native-encrypted-storage`
