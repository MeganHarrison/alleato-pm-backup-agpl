"use client";

export interface BudgetCode {
  id: string;
  code: string;
  costCodeId?: string | null;
  costType: string | null;
  costTypeId?: string | null;
  description: string;
  fullLabel: string;
}

export interface MarkupFormItem {
  id: string; // "markup-*" prefix = not yet in DB; UUID = already saved
  markup_type: string;
  percentage: number;
  compound: boolean;
  calculation_order: number;
  display_in: "horizontal" | "vertical";
  maps_to: string; // "all" or budget code ID
}

export interface SOVLineItem {
  id: string;
  isGroup?: boolean;
  isMarkup?: boolean;
  markupType?: string;
  changeEventLineItemId?: string;
  budgetCodeId?: string;
  budgetCodeLabel?: string;
  description: string;
  amount: number;
  quantity?: number;
  unitCost?: number;
  unitOfMeasure?: string;
  billedToDate: number;
  amountRemaining: number;
}

export interface ContractFormData {
  number: string;
  title: string;
  ownerCompanyId?: string;
  contractorId?: string;
  architectEngineerId?: string;
  contractCompanyId?: string;
  status: string;
  executed: boolean;
  defaultRetainage?: number;
  retentionPercent?: number;
  description?: string;
  originalAmount?: number;
  revisedAmount?: number;
  startDate?: Date;
  estimatedCompletionDate?: Date;
  substantialCompletionDate?: Date;
  actualCompletionDate?: Date;
  signedContractReceivedDate?: Date;
  contractTerminationDate?: Date;
  sovItems?: SOVLineItem[];
  markups?: MarkupFormItem[];
  accountingMethod?: "amount" | "unit_quantity";
  paymentTerms?: string;
  billingSchedule?: string;
  inclusions?: string;
  exclusions?: string;
  isPrivate: boolean;
  allowedUsers?: string[];
  allowedUsersCanSeeSov?: boolean;
  attachments?: Array<{
    name: string;
    size: number;
    type: string;
    url?: string;
  }>;
}
