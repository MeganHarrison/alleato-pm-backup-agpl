'use client';

import { LayoutGrid, List, Layers } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

// ─── Section 1: Report ───────────────────────────────────────────────────────

function ContentPlaceholder() {
  return (
    <div className="relative h-full overflow-hidden rounded bg-muted">
      <svg className="absolute inset-0 h-full w-full stroke-border" fill="none">
        <defs>
          <pattern id="pattern-1" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M-3 13 15-5M-5 5l18-18M-1 21 17 3" />
          </pattern>
        </defs>
        <rect stroke="none" fill="url(#pattern-1)" width="100%" height="100%" />
      </svg>
    </div>
  );
}

function ReportSection() {
  return (
    <div>
      <div className="sm:flex sm:items-center sm:justify-between">
        <p className="text-base font-semibold text-foreground">Report</p>
        <div className="mt-4 sm:mt-0 sm:flex sm:items-center sm:space-x-2">
          <Select defaultValue="1">
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Today</SelectItem>
              <SelectItem value="2">Last 7 days</SelectItem>
              <SelectItem value="3">Last 4 weeks</SelectItem>
              <SelectItem value="4">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Select defaultValue="1">
            <SelectTrigger className="mt-2 w-full sm:mt-0 sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">US-West</SelectItem>
              <SelectItem value="2">US-East</SelectItem>
              <SelectItem value="3">EU-Central-1</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Tabs defaultValue="overview" className="mt-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="detail">Detail</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Card key={i} className="h-36 rounded-sm p-2">
                <CardContent className="h-full p-0">
                  <ContentPlaceholder />
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="detail" className="mt-4">
          <Card className="h-72 rounded-sm p-2">
            <CardContent className="h-full p-0">
              <ContentPlaceholder />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Section 2: Workspaces ────────────────────────────────────────────────────

const workspaces = [
  {
    name: 'Test Workspace',
    details: [
      { type: 'Storage', value: '5/10GB' },
      { type: 'Users', value: '89/100' },
      { type: 'Requests', value: '995/10K' },
      { type: 'Status', value: 'Live' },
    ],
  },
  {
    name: 'BI Workspace',
    details: [
      { type: 'Storage', value: '9.8/10GB' },
      { type: 'Users', value: '23/100' },
      { type: 'Requests', value: '435/10K' },
      { type: 'Status', value: 'Inactive' },
    ],
  },
  {
    name: 'Livestream',
    details: [
      { type: 'Storage', value: '5.6/10GB' },
      { type: 'Users', value: '79/100' },
      { type: 'Requests', value: '642/10K' },
      { type: 'Status', value: 'Live' },
    ],
  },
  {
    name: 'Prod Workspace',
    details: [
      { type: 'Storage', value: '9.8/10GB' },
      { type: 'Users', value: '23/100' },
      { type: 'Requests', value: '435/10K' },
      { type: 'Status', value: 'Inactive' },
    ],
  },
  {
    name: 'Test Pipelines',
    details: [
      { type: 'Storage', value: '5.9/10GB' },
      { type: 'Users', value: '89/100' },
      { type: 'Requests', value: '995/10K' },
      { type: 'Status', value: 'Live' },
    ],
  },
];

function StatusBadge({ value }: { value: string }) {
  if (value === 'Live') {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-emerald-800 bg-emerald-100 ring-1 ring-inset ring-emerald-600/10">
        {value}
      </span>
    );
  }
  if (value === 'Inactive') {
    return (
      <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium text-muted-foreground bg-muted ring-1 ring-inset ring-border">
        {value}
      </span>
    );
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>;
}

function WorkspacesSection() {
  return (
    <Tabs defaultValue="grid">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <p className="text-sm font-medium text-foreground">Workspaces</p>
          <span className="inline-flex size-6 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground">
            {workspaces.length}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          <TabsList className="h-8 bg-transparent p-0">
            <TabsTrigger value="grid" className="h-8 w-8 p-0">
              <LayoutGrid className="h-4 w-4" />
            </TabsTrigger>
            <TabsTrigger value="list" className="h-8 w-8 p-0">
              <List className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>
          <div className="hidden h-8 w-px bg-border sm:block" />
          <Button size="sm" className="hidden sm:block">
            Add workspace
          </Button>
        </div>
      </div>

      <Separator className="my-4" />

      <TabsContent value="grid">
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <Card key={ws.name} className="relative overflow-hidden p-0">
              <div className="border-b border-border bg-muted/50 p-6">
                <div className="flex items-center space-x-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded border border-border bg-background">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  </span>
                  <p className="text-sm font-medium text-foreground">
                    <a href="#" className="focus:outline-none">
                      <span className="absolute inset-0" aria-hidden />
                      {ws.name}
                    </a>
                  </p>
                </div>
              </div>
              <div className="px-6 py-4">
                <ul className="divide-y divide-border">
                  {ws.details.map((item) => (
                    <li key={item.type} className="flex items-center justify-between py-2.5 text-sm">
                      <span className="text-muted-foreground">{item.type}</span>
                      <StatusBadge value={item.value} />
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="list">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="pb-3 text-left font-medium text-foreground">Name</th>
              <th className="pb-3 text-left font-medium text-foreground">Storage</th>
              <th className="pb-3 text-left font-medium text-foreground">Users</th>
              <th className="pb-3 text-left font-medium text-foreground">Requests/Limit</th>
              <th className="pb-3 text-left font-medium text-foreground">Status</th>
              <th className="pb-3"><span className="sr-only">Edit</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {workspaces.map((ws) => (
              <tr key={ws.name} className="hover:bg-muted/50">
                <td className="py-3 font-medium text-foreground">{ws.name}</td>
                <td className="py-3 text-muted-foreground">{ws.details[0].value}</td>
                <td className="py-3 text-muted-foreground">{ws.details[1].value}</td>
                <td className="py-3 text-muted-foreground">{ws.details[2].value}</td>
                <td className="py-3"><StatusBadge value={ws.details[3].value} /></td>
                <td className="py-3 text-right">
                  <a href="#" className="text-xs font-medium text-primary hover:underline">
                    Edit<span className="sr-only"> {ws.name}</span>
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TabsContent>
    </Tabs>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DemoPage() {
  return (
    <div className="space-y-12 p-4 sm:p-6 lg:p-8">
      <ReportSection />
      <Separator />
      <WorkspacesSection />
    </div>
  );
}
