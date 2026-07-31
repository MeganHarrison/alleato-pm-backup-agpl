import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageShell } from "@/components/layout";
import { Textarea } from "@/components/ui/textarea";
import { getLearningTaxonomy } from "@/lib/learning/server";
import { requireTrainingReviewerPageAccess } from "@/lib/training/reviewer-access";

import { createResourceAction } from "../../actions";

export default async function NewResourcePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireTrainingReviewerPageAccess();
  const [{ roles, topics }, { error }] = await Promise.all([
    getLearningTaxonomy(),
    searchParams,
  ]);
  return (
    <PageShell
      variant="form"
      title="Submit resource"
      description="Add an external video, document, or course. A reviewer must approve it before employees see it."
      breadcrumbs={[
        { label: "Content Studio", href: "/content" },
        { label: "New resource" },
      ]}
    >
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <form action={createResourceAction} className="space-y-6">
        <Field label="Title" name="title" />
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} />
        </div>
        <Field label="Source URL" name="url" type="url" placeholder="https://" />
        <div className="grid gap-6 sm:grid-cols-2">
          <SelectField label="Topic" name="topicId">
            {topics.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.name}</option>
            ))}
          </SelectField>
          <SelectField label="Format" name="resourceType">
            <option value="video">Video</option>
            <option value="doc">Document</option>
            <option value="course">External course</option>
          </SelectField>
          <SelectField label="Depth" name="level">
            <option value="intro">Introduction</option>
            <option value="deep-dive">Deep dive</option>
          </SelectField>
          <Field label="Track" name="track" placeholder="Project Management" />
          <Field label="Provider" name="provider" placeholder="Alleato or source organization" />
          <Field label="Duration in minutes" name="durationMinutes" type="number" required={false} />
        </div>
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Relevant roles</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => (
              <label key={role.id} className="flex min-h-11 items-center gap-3 text-sm">
                <input type="checkbox" name="roleIds" value={role.id} className="size-4" />
                {role.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex justify-end">
          <Button type="submit">Submit for review</Button>
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

function SelectField({
  label,
  name,
  children,
}: {
  label: string;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <select
        id={name}
        name={name}
        required
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      >
        {children}
      </select>
    </div>
  );
}
