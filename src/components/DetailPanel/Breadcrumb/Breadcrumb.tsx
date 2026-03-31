import styles from './Breadcrumb.module.css';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ path, onNavigate }: Props) {
  const parts = path ? path.split('/') : [];

  const handleKeyDown = (e: KeyboardEvent, navPath: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onNavigate(navPath);
    }
  };

  return (
    <div class={styles.breadcrumb}>
      <span
        class={styles.link}
        tabIndex={0}
        role="button"
        onClick={() => onNavigate('')}
        onKeyDown={(e) => handleKeyDown(e as unknown as KeyboardEvent, '')}
      >
        All Tours
      </span>
      {parts.map((part, i) => {
        const accumulated = parts.slice(0, i + 1).join('/');
        return (
          <span key={accumulated}>
            <span class={styles.sep}> / </span>
            <span
              class={styles.link}
              tabIndex={0}
              role="button"
              onClick={() => onNavigate(accumulated)}
              onKeyDown={(e) => handleKeyDown(e as unknown as KeyboardEvent, accumulated)}
            >
              {part}
            </span>
          </span>
        );
      })}
    </div>
  );
}
