import type { GenericTableConfig } from "@/components/tables/generic-table-factory";
import { fmdsFiguresConfig } from "./fmds-figures";
import { fmdsTablesConfig } from "./fmds-tables";

export const asrsWorkspaceTabs = [
  { label: "Assessment", href: "/asrs/intake" },
  { label: "Chat", href: "/asrs" },
  { label: "Tables", href: "/asrs/tables" },
  { label: "Figures", href: "/asrs/figures" },
];

export const asrsTablesConfig: GenericTableConfig = {
  ...fmdsTablesConfig,
  rowClickPath: "/asrs/tables/{id}",
};

export const asrsFiguresConfig: GenericTableConfig = {
  ...fmdsFiguresConfig,
  rowClickPath: "/asrs/figures/{id}",
};
