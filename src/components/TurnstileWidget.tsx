// Native stub — Turnstile only runs on web.
interface Props {
  onToken: (token: string) => void;
  onExpire: () => void;
}

export function TurnstileWidget(_props: Props) {
  return null;
}
