const { RuleTester } = require("eslint");
const rule = require("./no-stacked-table-cell");

const tester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

tester.run("no-stacked-table-cell", rule, {
  valid: [
    {
      // One column, one attribute — the corrected training-docs title cell.
      code: `
        const columns = [{
          id: "title",
          render: (doc) => <CellLink value={doc.title} href={"/training-docs/" + doc.id} className="font-medium" />,
        }];
      `,
    },
    {
      // Inline spans on a single line are not stacked.
      code: `
        const columns = [{
          id: "number",
          render: (item) => (
            <div className="cursor-default">
              <span className="font-mono text-muted-foreground">{item.number}</span>
              {" - "}
              <span className="font-medium">{item.title}</span>
            </div>
          ),
        }];
      `,
    },
    {
      // Icon + label on one row (explicitly inline) is not stacked.
      code: `
        const columns = [{
          id: "project",
          render: (row) => (
            <div className="flex items-center gap-2">
              <FolderIcon className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{row.projectName}</span>
            </div>
          ),
        }];
      `,
    },
    {
      // A tooltip surface may stack lines — it is not the cell.
      code: `
        const columns = [{
          id: "title",
          render: (row) => (
            <Tooltip>
              <TooltipTrigger asChild><span>{row.title}</span></TooltipTrigger>
              <TooltipContent className="space-y-1">
                <p className="font-semibold">{row.title}</p>
                <p className="text-muted-foreground">{row.status}</p>
              </TooltipContent>
            </Tooltip>
          ),
        }];
      `,
    },
    {
      // CellStackText with only primary (+ icon) is inline, not stacked.
      code: `
        const columns = [{
          id: "file",
          render: (item) => <CellStackText primary={item.fileName} icon={<Paperclip />} />,
        }];
      `,
    },
    {
      // An explicit no-op secondary is allowed (renders nothing).
      code: `
        const columns = [{
          id: "actor",
          render: (item) => <CellStackText primary={item.name} secondary={undefined} />,
        }];
      `,
    },
  ],
  invalid: [
    {
      // The reported case: slug stacked under the title (training-docs).
      code: `
        const columns = [{
          id: "title",
          render: (doc) => (
            <div className="min-w-0">
              <div className="truncate"><CellLink value={doc.title} href="/x" /></div>
              <div className="truncate text-xs text-muted-foreground">{doc.slug}</div>
            </div>
          ),
        }];
      `,
      errors: [{ messageId: "noStackedTableCell" }],
    },
    {
      // flex-col container with a muted secondary line (ai-agents name cell).
      code: `
        const columns = [{
          id: "name",
          render: (a) => (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-sm font-medium truncate">{a.name}</span>
              <span className="text-xs text-muted-foreground truncate">{a.slug}</span>
            </div>
          ),
        }];
      `,
      errors: [{ messageId: "noStackedTableCell" }],
    },
    {
      // space-y container with a muted caption under a value (daily briefs).
      code: `
        const columns = [{
          id: "rag",
          render: (item) => (
            <div className="space-y-1 text-sm">
              <span className="tabular-nums">{item.embeddedSourceCount}</span>
              <span className="block text-xs text-muted-foreground">{item.status}</span>
            </div>
          ),
        }];
      `,
      errors: [{ messageId: "noStackedTableCell" }],
    },
    {
      // Conditionally rendered secondary line still counts (ai-agents trigger).
      code: `
        const columns = [{
          id: "trigger",
          render: (a) => (
            <div className="flex flex-col gap-0.5 min-w-0">
              <span className="text-xs font-medium">{a.trigger_type}</span>
              {a.trigger_detail && (
                <span className="text-xs text-muted-foreground truncate">{a.trigger_detail}</span>
              )}
            </div>
          ),
        }];
      `,
      errors: [{ messageId: "noStackedTableCell" }],
    },
    {
      // The shared CellStackText primitive with a live secondary value — the
      // exact shape that slipped past the raw-JSX walk (project-creation-log).
      code: `
        const columns = [{
          id: "actor",
          render: (item) => (
            <CellStackText primary={item.name} secondary={item.userId ?? undefined} />
          ),
        }];
      `,
      errors: [{ messageId: "noStackedCellComponent" }],
    },
    {
      // A literal string secondary is still a stacked line.
      code: `
        const columns = [{
          id: "file",
          render: (item) => <CellStackText primary={item.fileName} secondary="PDF" />,
        }];
      `,
      errors: [{ messageId: "noStackedCellComponent" }],
    },
  ],
});

console.log("no-stacked-table-cell: all RuleTester cases passed");
