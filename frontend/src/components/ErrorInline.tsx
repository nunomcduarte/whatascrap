interface ErrorInlineProps {
  message: string;
}

export default function ErrorInline({ message }: ErrorInlineProps) {
  return (
    <p className="text-red-400 text-sm mt-2">{message}</p>
  );
}
