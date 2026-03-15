import { useState, useRef, useCallback, useEffect } from 'react';

export function useAutoHideMessage(duration = 5000) {
  const [message, setMessage] = useState('');
  const timerRef = useRef(null);

  const show = useCallback((msg) => {
    setMessage(msg);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setMessage(''), duration);
  }, [duration]);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return [message, show];
}
