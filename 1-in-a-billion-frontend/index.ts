import { AppRegistry, View, Text } from 'react-native';
import { registerRootComponent } from 'expo';
import { createElement } from 'react';

let App;
try {
    App = require('./App').default;
} catch (e: any) {
    console.error("CRITICAL: Failed to load App component", e);
    App = () => createElement(View, { style: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'white', padding: 20 } },
        createElement(Text, { style: { color: 'red', fontSize: 18, fontWeight: 'bold', marginBottom: 10 } }, "App Failed to Load"),
        createElement(Text, { style: { color: 'black' } }, e?.message || String(e))
    );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
registerRootComponent(App);


