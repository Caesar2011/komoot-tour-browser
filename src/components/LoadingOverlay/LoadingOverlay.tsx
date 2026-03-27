import styles from './LoadingOverlay.module.css';

interface Props {
  visible: boolean;
  text?: string;
}

export function LoadingOverlay({ visible, text = 'Loading…' }: Props) {
  if (!visible) return null;

  return (
    <div class={styles.overlay}>
      <div class={styles.spinner} />
      <div class={styles.text}>{text}</div>
    </div>
  );
}
