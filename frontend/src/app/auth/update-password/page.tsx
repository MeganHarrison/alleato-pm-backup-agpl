import { UpdatePasswordForm } from "@/components/misc/update-password-form";

interface PageProps {
  searchParams: Promise<{ email?: string; next?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { email, next } = await searchParams;

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <UpdatePasswordForm email={email} next={next} />
      </div>
    </div>
  );
}
