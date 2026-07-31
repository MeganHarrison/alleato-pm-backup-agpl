/**
 * manifest-schema.js
 * Documents the shape of a manifest.json produced by procore-deep-crawl.js
 * This file is documentation only — not imported at runtime.
 *
 * MANIFEST STRUCTURE:
 *
 * {
 *   feature: "change-events",            // Feature key from feature-registry
 *   capturedAt: "2026-03-22T...",         // ISO timestamp
 *   procoreUrl: "https://...",            // Starting URL
 *
 *   states: {
 *     list: {
 *       id: "list",
 *       description: "Change Events list view",
 *       url: "https://...",               // Actual URL at time of capture
 *
 *       columnGroups: [                   // AG Grid column groups (frozen + scrollable)
 *         {
 *           label: "Change Event #",      // Column group header text
 *           columns: ["#"],              // Child column headers
 *           colspan: 1                   // aria-colspan from AG Grid
 *         },
 *         {
 *           label: "Financial Impact",
 *           columns: ["Budget Amount", "ROM Amount"],
 *           colspan: 2
 *         }
 *       ],
 *
 *       columns: [                        // All leaf columns (flat, deduplicated)
 *         {
 *           label: "#",
 *           sortable: true,
 *           filterable: false,
 *           columnGroup: "Change Event #"  // parent group if any
 *         }
 *       ],
 *
 *       toolbarActions: [                 // Buttons/menus in the list toolbar
 *         { label: "Create Change Event", type: "button", variant: "primary" },
 *         { label: "Export", type: "dropdown", options: ["CSV", "PDF"] },
 *         { label: "Import", type: "button" },
 *         { label: "Filters", type: "filter-panel" }
 *       ],
 *
 *       filters: [                        // Filter options available in filter panel
 *         { label: "Status", type: "select", options: ["Draft", "Open", "Closed"] },
 *         { label: "Date Range", type: "date-range" }
 *       ],
 *
 *       rowActions: [                     // Per-row kebab/context menu actions
 *         { label: "Edit" },
 *         { label: "Delete" },
 *         { label: "Duplicate" }
 *       ],
 *
 *       autoRows: [],                     // Auto-appended rows (lightning bolt = markup)
 *       screenshot: "screenshots/list.png",
 *       _capture_note: ""                 // Set if navigation failed or list was empty
 *     },
 *
 *     "create-form": {
 *       id: "create-form",
 *       description: "Create Change Event form/modal",
 *
 *       formSections: [                   // Grouped sections within the form
 *         {
 *           title: "General",             // Section heading (or "" for default)
 *           fields: [
 *             {
 *               name: "title",            // Field name/id attribute
 *               label: "Title",           // Visible label text
 *               type: "text",            // input type, select, textarea, date, number...
 *               required: true,
 *               placeholder: "Add title",
 *               options: [],              // For select/radio/checkbox fields
 *               helpText: ""
 *             },
 *             {
 *               name: "status",
 *               label: "Status",
 *               type: "select",
 *               required: false,
 *               options: ["Draft", "Open", "Closed", "Void"]
 *             }
 *           ]
 *         }
 *       ],
 *
 *       actions: [                        // Form submission buttons
 *         { label: "Create Change Event", type: "submit" },
 *         { label: "Cancel", type: "cancel" }
 *       ],
 *
 *       screenshot: "screenshots/create-form.png"
 *     },
 *
 *     detail: {
 *       id: "detail",
 *       description: "Change Event detail page",
 *       url: "https://...",
 *
 *       tabs: [                           // Tab labels visible in the detail view
 *         "Overview",
 *         "Line Items",
 *         "Markup",
 *         "Prime Contract COs",
 *         "Emails"
 *       ],
 *
 *       headerFields: [                   // Key-value pairs in the detail header
 *         { label: "Status", value: "(captured value)" },
 *         { label: "Title", value: "..." }
 *       ],
 *
 *       screenshot: "screenshots/detail.png"
 *     },
 *
 *     "detail-line-items": {
 *       id: "detail-line-items",
 *       description: "Change Event detail — Line Items tab",
 *
 *       columnGroups: [...],              // Same structure as list.columnGroups
 *       columns: [...],
 *       toolbarActions: [...],
 *       autoRows: [                       // Auto-appended rows
 *         { label: "Insurance", autoCalculated: true },
 *         { label: "Fee", autoCalculated: true }
 *       ],
 *
 *       screenshot: "screenshots/detail-line-items.png"
 *     }
 *   }
 * }
 */

export const MANIFEST_VERSION = '1.0';
