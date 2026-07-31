"use client";

import { useRouter } from "next/navigation";

import { ChevronDown } from "lucide-react";


import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChangeEventSelectionBarProps {
  selectedCount: number;
  hasItems: boolean;
  onSendRfq: () => void;
  selectedChangeEventIds: string[];
  projectId: number;
  onSuccess?: () => void;
  onAddToCommitmentChangeOrder?: () => void;
}

export function ChangeEventSelectionBar({
  selectedCount,
  hasItems,
  onSendRfq,
  selectedChangeEventIds,
  projectId,
  onSuccess,
  onAddToCommitmentChangeOrder,
}: ChangeEventSelectionBarProps) {
  const router = useRouter();
  if (selectedCount > 0) {
    return (
      <>
        <div className="flex items-center gap-1.5 py-2 px-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5">
                Add to
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Add to Commitment</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem
                    onSelect={() => {
                      router.push(`/${projectId}/commitments/new?type=purchase_order`);
                    }}
                  >
                    New Purchase Order
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={() => {
                      router.push(`/${projectId}/commitments/new?type=subcontract`);
                    }}
                  >
                    New Subcontract
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuItem
                onSelect={() => {
                  if (onAddToCommitmentChangeOrder) {
                    onAddToCommitmentChangeOrder();
                    return;
                  }

                  router.push(`/${projectId}/change-events`);
                }}
              >
                Create Commitment CO
              </DropdownMenuItem>

              <DropdownMenuItem
                onSelect={() => {
                  const ids = selectedChangeEventIds.join(",");
                  router.push(
                    `/${projectId}/prime-contract-pcos/new?changeEventIds=${encodeURIComponent(ids)}`,
                  );
                }}
              >
                Create Prime Contract PCO
              </DropdownMenuItem>

            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" onClick={onSendRfq}>
            Send RFQ
          </Button>
        </div>

      </>
    );
  }

  return null;
}
