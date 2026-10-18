/**
 * @module components/ui/SheetHost
 * One system window that hosts any number of stacked `Sheet`s. iOS cannot present a modal on top of another
 * modal (the second never appears and the first stays stuck), so sheets that open over each other
 * (list, then detail, then a form) must live together inside a single host instead of being modals themselves.
 * Render the host's sheets as in-screen `Sheet`s (no `modal` prop). The host is only visible while it has children.
 */
import { Modal, StyleSheet, View } from 'react-native';

export default function SheetHost({ visible, onRequestClose, children }) {
  return (
    <Modal transparent visible={visible} animationType="none" statusBarTranslucent onRequestClose={onRequestClose}>
      {visible ? <View style={styles.fill}>{children}</View> : null}
    </Modal>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
