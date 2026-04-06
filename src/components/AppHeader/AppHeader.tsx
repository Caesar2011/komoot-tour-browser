import styles from './AppHeader.module.css';

interface Props {
  displayName: string;
  onLogout: () => void;
  onUpload: () => void;
  onToggleSidebar: () => void;
}

export function AppHeader({
  displayName,
  onLogout,
  onUpload,
  onToggleSidebar,
}: Props) {
  return (
    <header class={styles.header}>
      <div class={styles.left}>
        <button
          class={`icon-btn ${styles.hamburger}`}
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          ☰
        </button>
        <h2 class={styles.title}>🏔️ Komoot Tour Browser</h2>
      </div>
      <div class={styles.userInfo}>
        <button class={styles.uploadBtn} onClick={onUpload} tabIndex={0}>
          📤 <span class={styles.uploadLabel}>Upload</span>
        </button>
        <span class={styles.displayName}>{displayName}</span>
        <button class={styles.logoutBtn} onClick={onLogout} tabIndex={0}>
          Logout
        </button>
      </div>
    </header>
  );
}
