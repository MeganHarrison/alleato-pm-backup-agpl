/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

import ChangeEventDetailPage from "../page";
import { useChangeEventDetail } from "@/hooks/use-change-event-detail";

const push = jest.fn();
const updateStatus = jest.fn();

jest.mock("next/navigation", () => ({
  useParams: () => ({
    projectId: "876",
    changeEventId: "927f077e-3883-441c-b275-58b55a4f9db9",
  }),
  useRouter: () => ({
    push,
  }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    loading: jest.fn(),
  },
}));

jest.mock("@/hooks/useProjectTitle", () => ({
  useProjectTitle: jest.fn(),
}));

jest.mock("@/lib/api-client", () => ({
  apiFetch: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/hooks/use-pdf-export", () => ({
  usePdfExport: () => ({
    exportPdf: jest.fn(),
  }),
}));

jest.mock("@/components/layout", () => ({
  ContentSectionStack: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PageShell: ({
    children,
    title,
    actions,
  }: {
    children: ReactNode;
    title: string;
    actions?: ReactNode;
  }) => (
    <main>
      <h1>{title}</h1>
      {actions}
      {children}
    </main>
  ),
}));

jest.mock("@/components/layout/inline", () => ({
  Inline: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/layout/PageTabs", () => ({
  PageTabs: () => <div>tabs</div>,
}));

jest.mock("@/components/ds", () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({ error }: { error: string }) => <div>{error}</div>,
}));

jest.mock("@/components/ds/text", () => ({
  Text: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}));

jest.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled ? "true" : undefined}
      onClick={disabled ? undefined : onClick}
    >
      {children}
    </div>
  ),
}));

const { Button: MockButton } = jest.requireMock("@/components/ui/button") as {
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => ReactNode;
};

jest.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({
    children,
    onClick,
    onSelect,
    ...props
  }: {
    children: ReactNode;
    onClick?: () => void;
    onSelect?: () => void;
  }) => (
    <MockButton
      onClick={() => {
        onClick?.();
        onSelect?.();
      }}
      {...props}
    >
      {children}
    </MockButton>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  DropdownMenuSubTrigger: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/alert-dialog", () => ({
  AlertDialog: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogAction: ({ children }: { children: ReactNode }) => <MockButton>{children}</MockButton>,
  AlertDialogCancel: ({ children }: { children: ReactNode }) => <MockButton>{children}</MockButton>,
  AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/ui/skeleton", () => ({
  Skeleton: () => <div>loading</div>,
}));

jest.mock("@/components/ui/sheet", () => ({
  Sheet: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/comments/entity-comments", () => ({
  EntityComments: () => <div>comments</div>,
}));

jest.mock("@/components/comments/entity-room", () => ({
  EntityRoom: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock("@/components/domain/change-events/AddToCommitmentCODialog", () => ({
  AddToCommitmentCODialog: () => null,
}));

jest.mock("@/components/domain/change-events/AddToPrimePCODialog", () => ({
  AddToPrimePCODialog: () => null,
}));

jest.mock("@/components/domain/change-events/AddToBudgetChangeDialog", () => ({
  AddToBudgetChangeDialog: () => null,
}));

jest.mock("@/components/domain/change-events/ChangeEventEmailDialog", () => ({
  ChangeEventEmailDialog: () => null,
}));

jest.mock("@/components/domain/change-events/ChangeEventGeneralInfoPanel", () => ({
  ChangeEventGeneralInfoPanel: () => <div>general-panel</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventLineagePanel", () => ({
  ChangeEventLineagePanel: () => <div>lineage-panel</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventLineItemsTable", () => ({
  ChangeEventLineItemsTable: () => <div>line-items</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventHistoryTab", () => ({
  ChangeEventHistoryTab: () => <div>history</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventRelatedItemsTab", () => ({
  ChangeEventRelatedItemsTab: () => <div>related-items</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventRfqsTab", () => ({
  ChangeEventRfqsTab: () => <div>rfqs</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventPrimePCOsSection", () => ({
  ChangeEventPrimePCOsSection: () => <div>prime-pcos</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventCommitmentPCOsSection", () => ({
  ChangeEventCommitmentPCOsSection: () => <div>commitment-pcos</div>,
}));

jest.mock("@/components/domain/change-events/ChangeEventRfqForm", () => ({
  ChangeEventRfqForm: () => <div>rfq-form</div>,
}));

jest.mock("@/components/domain/change-events/change-event-form/useDropdownData", () => ({
  useDropdownData: () => ({
    contracts: [],
  }),
}));

jest.mock("@/hooks/use-change-event-detail", () => ({
  useChangeEventDetail: jest.fn(),
}));

const mockUseChangeEventDetail = useChangeEventDetail as jest.MockedFunction<
  typeof useChangeEventDetail
>;

describe("ChangeEventDetailPage", () => {
  beforeEach(() => {
    push.mockReset();
    updateStatus.mockReset();
    mockUseChangeEventDetail.mockReturnValue({
      changeEvent: {
        id: "927f077e-3883-441c-b275-58b55a4f9db9",
        number: "CE-42",
        title: "Existing approved change event",
        status: "Approved",
        type: "TBD",
        scope: "TBD",
        origin: "Internal",
        description: "",
        history: [],
      },
      lineItems: [],
      attachments: [],
      historyEntries: [],
      relatedItems: [],
      rfqCount: 0,
      isLoading: false,
      error: null,
      actions: {
        refetch: jest.fn(),
        updateStatus,
        deleteChangeEvent: jest.fn(),
        deleteLineItem: jest.fn(),
        submitEdit: jest.fn(),
        fetchRelatedItemOptions: jest.fn(),
        linkRelatedItem: jest.fn(),
        unlinkRelatedItem: jest.fn(),
      },
    } satisfies ReturnType<typeof useChangeEventDetail>);
  });

  it("shows reopen for approved change events and sends the open status update", async () => {
    render(<ChangeEventDetailPage />);

    const reopenButton = screen.getByRole("button", { name: /reopen/i });
    expect(reopenButton).toBeInTheDocument();

    await userEvent.click(reopenButton);

    expect(updateStatus).toHaveBeenCalledWith("open");
  });
});
