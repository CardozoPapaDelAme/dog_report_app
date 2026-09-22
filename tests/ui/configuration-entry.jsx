// Isolated UI test entry. This file is never imported by index.js or App.js.
import React, { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import '../../i18n/index.js';
import ConfigurationScreen from '../../screens/ConfigurationScreen.js';
import regular from '@expo-google-fonts/plus-jakarta-sans/400Regular/PlusJakartaSans_400Regular.ttf';
import bold from '@expo-google-fonts/plus-jakarta-sans/700Bold/PlusJakartaSans_700Bold.ttf';

const fonts = document.createElement('style');
fonts.textContent = `@font-face{font-family:PlusJakartaSans_400Regular;src:url(${regular})} @font-face{font-family:PlusJakartaSans_700Bold;src:url(${bold})}`;
document.head.appendChild(fonts);

function Fixture() {
  const [token, setToken] = useState(new URLSearchParams(location.search).has('no-session') ? null : 'test-session-a');
  const [visible, setVisible] = useState(true);
  return <div style={{height:'100dvh',display:'flex',flexDirection:'column'}}>
    <div style={{display:'flex',gap:8,padding:4,background:'#eee',font:'11px sans-serif'}}>
      <button onClick={()=>setToken(null)}>Cerrar sesión de prueba</button>
      <button onClick={()=>setToken('test-session-b')}>Otra sesión de prueba</button>
      <button onClick={()=>setVisible(true)}>Abrir formulario de prueba</button>
    </div>
    <SafeAreaProvider>{visible ? <ConfigurationScreen accessToken={token} onBack={()=>setVisible(false)} /> : <p>Formulario cerrado</p>}</SafeAreaProvider>
  </div>;
}
createRoot(document.getElementById('root')).render(<StrictMode><Fixture /></StrictMode>);
