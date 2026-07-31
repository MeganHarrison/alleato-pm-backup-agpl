import Link from "next/link";
import { BookOpen, FileText, GraduationCap, Library, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

const options = [
  {
    href: "/content/courses/new",
    label: "Course",
    icon: GraduationCap,
  },
  {
    href: "/training-docs",
    label: "Software guide",
    icon: BookOpen,
  },
  {
    href: "/knowledge/manage",
    label: "SOP or document",
    icon: FileText,
  },
  {
    href: "/content/resources/new",
    label: "Resource",
    icon: Library,
  },
];

export function ContentCreateMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm">
          <Plus aria-hidden="true" className="size-4" />
          <span>Create content</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {options.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild>
            <Link href={href}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
