import { useEffect, useRef } from 'react';
import { View } from 'react-native';

const SITE_KEY = '0x4AAAAAAC6kSbNeaU9DWDDR';

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
  const containerRef = useRef<View>(null);
  const widgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    const SCRIPT_ID = 'cf-turnstile-script';

    function renderWidget() {
      if (!containerRef.current || !window.turnstile) return;
      const domNode = containerRef.current as unknown as HTMLElement;
      widgetIdRef.current = window.turnstile.render(domNode, {
        sitekey: SITE_KEY,
        callback: onToken,
        'expired-callback': onExpire,
        'error-callback': onExpire,
        theme: 'light',
        size: 'normal',
        appearance: 'always',
      });
    }

    if (window.turnstile) {
      renderWidget();
    } else {
      let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      if (!script) {
        script = document.createElement('script');
        script.id = SCRIPT_ID;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
        script.async = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', renderWidget);
    }

    return () => {
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, []);

  return <View ref={containerRef} style={{ minHeight: 65, marginVertical: 8 }} />;
}
