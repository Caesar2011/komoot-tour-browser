import styles from './Breadcrumb.module.css';

interface Props {
  path: string;
  onNavigate: (path: string) => void;
}

export function Breadcrumb({ path, onNavigate }: Props) {
  const parts = path ? path.split('/') : [];

  return (
    <div class={styles.breadcrumb}>
      <span class={styles.link} onClick={() => onNavigate('')}>
        All Tours
      </span>
      {parts.map((part, i) => {
        const accumulated = parts.slice(0, i + 1).join('/');
        return (
          <span key={accumulated}>
            <span class={styles.sep}> / </span>
            <span class={styles.link} onClick={() => onNavigate(accumulated)}>
              {part}
            </span>
          </span>
        );
      })}
    </div>
  );
}
