import { useEffect, useState } from 'react';

export function useSplash(ms = 1100): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return visible;
}
