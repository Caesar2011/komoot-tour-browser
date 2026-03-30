import styles from './AppHeader.module.css';

interface Props {
  displayName: string;
  onLogout: () => void;
  onUpload: () => void;
}

export function AppHeader({ displayName, onLogout, onUpload }: Props) {
  return (
    <header class={styles.header}>
      <h2>🏔️ Komoot Tour Browser</h2>
      <div class={styles.userInfo}>
        <button class={styles.uploadBtn} onClick={onUpload}>
          📤 Upload
        </button>
        <span>{displayName}</span>
        <button class={styles.logoutBtn} onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
