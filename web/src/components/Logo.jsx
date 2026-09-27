// Il marchio è il viaggio che il sito calcola: da casa in treno, in volo, di nuovo in treno fino alla porta.
export function LogoMark({ size = 30 }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="2 8 28 18" aria-hidden>
      <path d="M5 22h5m12 0h5" stroke="var(--rail)" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M10 22c0-12 12-12 12 0" fill="none" stroke="var(--air)" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="5" cy="22" r="3.4" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.6" />
      <circle cx="27" cy="22" r="3.4" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2.6" />
    </svg>
  );
}
