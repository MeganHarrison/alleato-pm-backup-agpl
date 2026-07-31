import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { requireTrainingReviewerPageAccess } from "@/lib/training/reviewer-access";

import { createCourseAction } from "../../actions";

export default async function NewCoursePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireTrainingReviewerPageAccess();
  const { error } = await searchParams;
  return (
    <PageShell
      variant="form"
      title="Create course"
      description="Define the learning outcome first. Add existing guides, SOPs, and resources after the course is created."
      breadcrumbs={[
        { label: "Content Studio", href: "/content" },
        { label: "New course" },
      ]}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form action={createCourseAction} className="space-y-6">
        <Field label="Course title" name="title" placeholder="Project Manager Software Orientation" />
        <Field label="URL slug" name="slug" placeholder="project-manager-software-orientation" />
        <div className="space-y-2">
          <Label htmlFor="summary">Summary</Label>
          <Textarea id="summary" name="summary" rows={3} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outcome">Learning outcome</Label>
          <Textarea
            id="outcome"
            name="outcome"
            rows={3}
            required
            placeholder="After this course, the employee can..."
          />
        </div>
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Difficulty" name="difficulty" placeholder="Foundation" />
          <Field
            label="Estimated minutes"
            name="estimatedMinutes"
            type="number"
            defaultValue="45"
          />
        </div>
        <div className="flex justify-end">
          <Button type="submit">Create and add content</Button>
        </div>
      </form>
    </PageShell>
  );
}

function Field({
  label,
  name,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; name: string }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} required {...props} />
    </div>
  );
}
