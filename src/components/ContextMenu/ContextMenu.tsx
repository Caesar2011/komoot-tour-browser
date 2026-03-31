import { useEffect, useRef } from 'preact/hooks';

import styles from './ContextMenu.module.css';

export interface ContextMenuAction {
  label: string;
  icon: string;
  shortcut: string;
  onClick: () => void;
  danger?: boolean;
}

interface Props {
  x: number;
  y: number;
  actions: ContextMenuAction[];
  onClose: () => void;
}

export function ContextMenu({ x, y, actions, onClose }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Adjust position to keep menu within viewport
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.right > vw) {
      menuRef.current.style.left = `${x - rect.width}px`;
    }
    if (rect.bottom > vh) {
      menuRef.current.style.top = `${y - rect.height}px`;
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      class={styles.menu}
      style={{ left: x, top: y }}
      role="menu"
    >
      {actions.map((action) => (
        <button
          key={action.label}
          class={`${styles.item} ${action.danger ? styles.danger : ''}`}
          role="menuitem"
          onClick={() => {
            action.onClick();
            onClose();
          }}
        >
          <span class={styles.icon}>{action.icon}</span>
          <span class={styles.label}>{action.label}</span>
          <kbd class={styles.shortcut}>{action.shortcut}</kbd>
        </button>
      ))}
    </div>
  );
}
