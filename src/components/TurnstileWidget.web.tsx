import { useEffect, useRef } from 'react';

const SITE_KEY = '0x4AAAAAAC6kSbNeaU9DWDDR';
const SCRIPT_ID = 'cf-turnstile-script';
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
          theme?: 'light' | 'dark' | 'auto';
          size?: 'normal' | 'compact';
          appearance?: 'always' | 'execute' | 'interaction-only';
        },
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

interface Props {
  onToken: (token: string) => void;
  onExpire: () => void;
}

export function TurnstileWidget({ onToken, onExpire }: Props) {
  // Use a real HTMLDivElement ref — React Native View refs are component
  // instances, not DOM nodes, and Turnstile requires an actual DOM element.
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Keep callback refs current so the widget never holds a stale closure.
  const onTokenRef = useRef(onToken);
  const onExpireRef = useRef(onExpire);
  useEffect(() => { onTokenRef.current = onToken; }, [onToken]);
  useEffect(() => { onExpireRef.current = onExpire; }, [onExpire]);

  useEffect(() => {
    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return;
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: SITE_KEY,
        callback: (token) => onTokenRef.current(token),
        'expired-callback': () => onExpireRef.current(),
        'error-callback': () => onExpireRef.current(),
        theme: 'light',
        size: 'normal',
        appearance: 'always',
      });
    }

    if (window.turnstile) {
      // API already loaded (e.g. component remounted after navigation).
      renderWidget();
    } else if (!document.getElementById(SCRIPT_ID)) {
      // First load — inject the script and render when ready.
      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = SCRIPT_SRC;
      script.async = true;
      script.onload = renderWidget;
      document.head.appendChild(script);
    } else {
      // Script tag exists but hasn't finished loading yet — poll until ready.
      const poll = setInterval(() => {
        if (window.turnstile) {
          clearInterval(poll);
          renderWidget();
        }
      }, 50);
      const timeout = setTimeout(() => clearInterval(poll), 10_000);
      return () => { clearInterval(poll); clearTimeout(timeout); };
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ minHeight: 65, marginTop: 8, marginBottom: 8 }}
    />
  );
}
