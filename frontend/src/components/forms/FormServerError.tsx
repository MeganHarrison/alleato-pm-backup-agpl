interface FormServerErrorProps {
  message?: string;
}

export function FormServerError({ message }: FormServerErrorProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
    >
      {message}
    </div>
  );
}