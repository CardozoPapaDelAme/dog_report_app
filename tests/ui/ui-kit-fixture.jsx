// Fixture for the shared base components (components/ui). Never imported by the app.
import React, { useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { AppButton, AppCard, AppTextField, Banner, Chip, IconButton, ScreenHeader, Sheet, StateView, iconNames, Icon } from '../../components/ui/index.js';
import { colors, type } from '../../theme/index.js';

export default function UiKitFixture() {
  const [presses, setPresses] = useState(0);
  const [sheet, setSheet] = useState(false);
  const [choice, setChoice] = useState('a');
  const fieldRef = useRef(null);
  return (
    <View style={{ height: '100dvh', backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
        <ScreenHeader title="Kit base" onBack={() => {}} backLabel="Atrás" />
        <Text style={type.display}>Aa 123</Text>
        <Text testID="kit-number" style={type.number}>1,234.50</Text>
        <Text style={type.labelCaps}>Etiqueta</Text>
        <AppButton title="Guardar" onPress={() => setPresses((n) => n + 1)} testID="kit-primary" />
        <AppButton title="Cancelar" variant="secondary" />
        <AppButton title="Eliminar" variant="destructive" />
        <AppButton title="Enviando" loading />
        <AppButton title="Deshabilitado" disabled />
        <Text testID="kit-presses">{`pulsaciones:${presses}`}</Text>
        <IconButton icon="close" accessibilityLabel="Cerrar kit" />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {iconNames.map((name) => <Icon key={name} name={name} />)}
        </View>
        <AppCard testID="kit-card"><Text style={type.title}>Tarjeta</Text><Text style={type.bodySmall}>Contenido</Text></AppCard>
        <AppTextField ref={fieldRef} label="Correo" nativeID="kit-field" testID="kit-field" placeholder="correo@ejemplo.com" />
        <AppTextField label="Nota" multiline error="Obligatorio" />
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Chip label="Pendiente" tone="warning" />
          <Chip label="Ataque" tone="attack" />
          <Chip label="Opción A" selected={choice === 'a'} onPress={() => setChoice('a')} />
          <Chip label="Opción B" selected={choice === 'b'} onPress={() => setChoice('b')} />
        </View>
        <Banner tone="warning" title="Aviso" message="Mensaje de ejemplo" />
        <Banner tone="error" title="Error" message="Algo falló" />
        <StateView kind="empty" title="Sin datos" message="No hay nada aquí" />
        <AppButton title="Abrir sheet" variant="secondary" onPress={() => setSheet(true)} />
      </ScrollView>
      {sheet ? (
        <Sheet testID="kit-sheet" onClose={() => setSheet(false)}>
          <Text style={type.title}>Sheet</Text>
          <AppButton title="Cerrar" variant="secondary" onPress={() => setSheet(false)} />
        </Sheet>
      ) : null}
    </View>
  );
}
