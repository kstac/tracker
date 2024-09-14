import {Stack} from 'expo-router';
import 'react-native-reanimated';

import {MD3LightTheme, PaperProvider} from "react-native-paper";

export default function RootLayout() {
  // TODO - Add support for dark mode
  return (
    <PaperProvider theme={ MD3LightTheme }>
      <Stack>
        <Stack.Screen name="index" options={{headerShown: false}} />
        <Stack.Screen name="+not-found" options={{headerShown: false}} />
      </Stack>
    </PaperProvider>
  );
}
