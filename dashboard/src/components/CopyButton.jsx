import { useState } from 'react';

export default function CopyButton({ value, label = 'Copy' }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can fail in some contexts — fail quietly, button
      // just won't show the "Copied!" confirmation.
    }
  }

  return (
    <button onClick={handleCopy} className="btn" style={{ padding: '3px 9px', fontSize: 12 }} type="button">
      {copied ? 'Copied!' : label}
    </button>
  );
}
