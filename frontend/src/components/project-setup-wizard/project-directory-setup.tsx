"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  addToProjectDirectory,
  updateProjectDirectoryEntry,
  deleteProjectDirectoryEntry,
} from "@/app/(main)/actions/project-directory-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, AlertCircle, Building, User } from "lucide-react";
import { EmptyState } from "@/components/ds";
import { StepComponentProps } from "./project-setup-wizard";
import type { Database } from "@/types/database.types";

type Company = Database["public"]["Tables"]["companies"]["Row"];
type Person = Database["public"]["Tables"]["people"]["Row"];
type ProjectDirectoryMembership =
  Database["public"]["Tables"]["project_directory_memberships"]["Row"];

interface ProjectDirectoryWithDetails extends ProjectDirectoryMembership {
  person?: Person;
  company?: Company;
}

const projectRoles = [
  { value: "owner", label: "Owner" },
  { value: "architect", label: "Architect" },
  { value: "engineer", label: "Engineer" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "vendor", label: "Vendor" },
];

export function ProjectDirectorySetup({
  projectId,
  onNext,
  onSkip,
}: StepComponentProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [companies, setCompanies] = useState<Company[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [projectDirectory, setProjectDirectory] = useState<
    ProjectDirectoryWithDetails[]
  >([]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPersonId, setSelectedPersonId] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [showNewPersonForm, setShowNewPersonForm] = useState(false);
  const [newPerson, setNewPerson] = useState({
    first_name: "",
    last_name: "",
    email: "",
    company_id: "",
  });

  const supabase = createClient();

  useEffect(() => {
    loadData();
  }, [projectId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const numericProjectId = parseInt(projectId, 10);
      if (isNaN(numericProjectId)) {
        throw new Error("Invalid project ID");
      }

      // Load companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .order("name");

      if (companiesError) throw companiesError;

      // Load people
      const { data: peopleData, error: peopleError } = await supabase
        .from("people")
        .select("*")
        .order("last_name", { ascending: true });

      if (peopleError) throw peopleError;

      // Load project directory memberships with person and company details
      const { data: directoryData, error: directoryError } = await supabase
        .from("project_directory_memberships")
        .select(
          `
          *,
          person:people(*)
        `,
        )
        .eq("project_id", numericProjectId)
        .order("created_at");

      if (directoryError) throw directoryError;

      setCompanies(companiesData || []);
      setPeople(peopleData || []);
      setProjectDirectory(directoryData as any || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const createNewPerson = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!newPerson.first_name || !newPerson.last_name) {
        setError("First and last name are required");
        return;
      }

      const { data, error } = await supabase
        .from("people")
        .insert({
          first_name: newPerson.first_name,
          last_name: newPerson.last_name,
          email: newPerson.email || null,
          company_id: newPerson.company_id || null,
          person_type: "employee",
        })
        .select()
        .single();

      if (error) throw error;

      setPeople([...people, data]);
      setSelectedPersonId(data.id);
      setShowNewPersonForm(false);
      setNewPerson({
        first_name: "",
        last_name: "",
        email: "",
        company_id: "",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create person");
    } finally {
      setSaving(false);
    }
  };

  const addToDirectory = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!selectedPersonId || !selectedRole) {
        setError("Please select a person and role");
        return;
      }

      const numericProjectId = parseInt(projectId, 10);
      if (isNaN(numericProjectId)) {
        throw new Error("Invalid project ID");
      }

      // Check if already exists
      const exists = projectDirectory.some(
        (d) => d.person_id === selectedPersonId,
      );
      if (exists) {
        setError("This person is already in the project directory");
        return;
      }

      const { data, error } = await supabase
        .from("project_directory_memberships")
        .insert({
          project_id: numericProjectId,
          person_id: selectedPersonId,
          role: selectedRole,
          status: "active",
          metadata: {
            permissions: {
              can_view: true,
              can_edit: false,
              can_approve: false,
              can_submit: true,
            },
          },
        })
        .select(`
          *,
          person:people(*)
        `)
        .single();

      if (error) throw error;

      setProjectDirectory([...projectDirectory, data as any]);
      setShowAddDialog(false);
      setSelectedPersonId("");
      setSelectedRole("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add to directory",
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (entryId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from("project_directory_memberships")
        .update({ status: isActive ? "active" : "inactive" })
        .eq("id", entryId);

      if (error) throw error;

      setProjectDirectory(
        projectDirectory.map((entry) =>
          entry.id === entryId ? { ...entry, status: isActive ? "active" : "inactive" } : entry,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update entry");
    }
  };

  const removeFromDirectory = async (entryId: string) => {
    try {
      const { error } = await supabase
        .from("project_directory_memberships")
        .delete()
        .eq("id", entryId);

      if (error) throw error;

      setProjectDirectory(
        projectDirectory.filter((entry) => entry.id !== entryId),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove entry");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-muted-foreground">
          Loading project directory...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        <p className="text-muted-foreground">
          Add people and assign their roles in this project. You can always
          update these assignments later.
        </p>

        {/* Directory Table */}
        {projectDirectory.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Email</TableHead>
                <TableHead className="w-24">Active</TableHead>
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectDirectory.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {entry.person?.first_name} {entry.person?.last_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {projectRoles.find((r) => r.value === entry.role)
                        ?.label || entry.role}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {entry.person?.email && (
                      <div className="text-sm text-muted-foreground">
                        {entry.person.email}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={entry.status === "active"}
                      onCheckedChange={(checked) =>
                        toggleActive(entry.id, checked)
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeFromDirectory(entry.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No people added yet"
            description="Add people to give them access to this project."
          />
        )}

        {/* Add Person Button */}
        <div className="flex justify-center">
          <Button onClick={() => setShowAddDialog(true)} variant="outline">
            <Plus />
            Add Person
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip} disabled={saving}>
          Skip for now
        </Button>
        <Button
          onClick={onNext}
          disabled={
            saving || projectDirectory.filter((d) => d.status === "active").length === 0
          }
        >
          Continue
        </Button>
      </div>

      {/* Add Person Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Person to Project</DialogTitle>
            <DialogDescription>
              Select a person and assign their role in this project
            </DialogDescription>
          </DialogHeader>

          {!showNewPersonForm ? (
            <div className="space-y-4">
              <div>
                <Label htmlFor="person">Person</Label>
                <Select
                  value={selectedPersonId}
                  onValueChange={setSelectedPersonId}
                >
                  <SelectTrigger id="person">
                    <SelectValue placeholder="Select a person" />
                  </SelectTrigger>
                  <SelectContent>
                    {people.map((person) => (
                      <SelectItem key={person.id} value={person.id}>
                        {person.first_name} {person.last_name}
                        {person.email && ` (${person.email})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0"
                  onClick={() => setShowNewPersonForm(true)}
                >
                  or create a new person
                </Button>
              </div>

              <div>
                <Label htmlFor="role">Role</Label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger id="role">
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectRoles.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowAddDialog(false)}
                >
                  Cancel
                </Button>
                <Button onClick={addToDirectory} disabled={saving}>
                  {saving ? "Adding..." : "Add to Project"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              {/* eslint-disable-next-line design-system/no-raw-heading */}
              <h4 className="font-medium">Create New Person</h4>

              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={newPerson.first_name}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, first_name: e.target.value })
                  }
                  placeholder="John"
                />
              </div>

              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={newPerson.last_name}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, last_name: e.target.value })
                  }
                  placeholder="Doe"
                />
              </div>

              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={newPerson.email}
                  onChange={(e) =>
                    setNewPerson({ ...newPerson, email: e.target.value })
                  }
                  placeholder="john.doe@example.com"
                />
              </div>

              <div>
                <Label htmlFor="company">Company</Label>
                <Select
                  value={newPerson.company_id}
                  onValueChange={(value) =>
                    setNewPerson({ ...newPerson, company_id: value })
                  }
                >
                  <SelectTrigger id="company">
                    <SelectValue placeholder="Select a company (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowNewPersonForm(false);
                    setNewPerson({
                      first_name: "",
                      last_name: "",
                      email: "",
                      company_id: "",
                    });
                  }}
                >
                  Back
                </Button>
                <Button onClick={createNewPerson} disabled={saving}>
                  {saving ? "Creating..." : "Create Person"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
