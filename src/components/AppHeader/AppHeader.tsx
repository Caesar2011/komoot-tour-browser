import styles from './AppHeader.module.css';

interface Props {
  displayName: string;
  onLogout: () => void;
}

export function AppHeader({ displayName, onLogout }: Props) {
  return (
    <header class={styles.header}>
      <h2>🏔️ Komoot Tour Browser</h2>
      <div class={styles.userInfo}>
        <span>{displayName}</span>
        <button class={styles.logoutBtn} onClick={onLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
