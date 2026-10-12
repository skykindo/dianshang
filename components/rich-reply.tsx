import type { ReactNode } from "react";

function inline(text: string, line: number): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) =>
    part.startsWith("**") && part.endsWith("**")
      ? <strong key={`${line}-${index}`}>{part.slice(2, -2)}</strong>
      : <span key={`${line}-${index}`}>{part}</span>,
  );
}

export default function RichReply({ text, className }: { text: string; className?: string }) {
  const lines = text.split(/\r?\n/);
  return <p className={className}>{lines.map((line, index) => <span key={index}>{inline(line, index)}{index < lines.length - 1 && <br />}</span>)}</p>;
}
