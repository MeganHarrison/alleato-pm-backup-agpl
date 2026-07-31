/**
 * @jest-environment jsdom
 */
import React, { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { PrimeContractAdvancedSettingsTab } from "../PrimeContractAdvancedSettingsTab";

const baseSettings = {
  project_id: 42,
  co_tier_count: 1 as const,
  allow_standard_users_create_pcco: false,
  allow_standard_users_create_pco: false,
  sov_always_editable: false,
  enable_completed_work_retainage: true,
  enable_stored_materials_retainage: false,
  default_retainage_percent: 10,
  show_markup_on_co_pdf: true,
  show_markup_on_invoice_pdf: true,
  default_distribution_prime_contract: null,
  default_distribution_pcco: null,
  default_distribution_pco: null,
};

const renderTab = () => {
  const Wrapper = () => {
    const [settings, setSettings] = useState(baseSettings);

    return (
      <PrimeContractAdvancedSettingsTab
        projectId="42"
        contractId="contract-1"
        advancedSettings={settings}
        setAdvancedSettings={setSettings}
        advancedSettingsLoading={false}
        advancedSettingsSaving={false}
        setAdvancedSettingsSaving={jest.fn()}
        contractAdvancedDraft={{
          inclusions: "",
          exclusions: "",
          is_private: false,
          payment_terms: "",
          billing_schedule: "",
        }}
        setContract={jest.fn()}
      />
    );
  };

  return render(<Wrapper />);
};

describe("PrimeContractAdvancedSettingsTab", () => {
  it("renders explicit retainage settings instead of the old mislabeled toggle", () => {
    renderTab();

    expect(
      screen.getByRole("checkbox", { name: "Enable Completed Work Retainage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Enable Stored Materials Retainage" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("spinbutton", { name: "Default Retainage Percent" }),
    ).toHaveValue(10);
    expect(
      screen.queryByLabelText("Enable Work Retainage This Period"),
    ).not.toBeInTheDocument();
  });

  it("updates retainage fields in local state", () => {
    renderTab();

    fireEvent.click(
      screen.getByRole("checkbox", { name: "Enable Stored Materials Retainage" }),
    );
    expect(
      screen.getByRole("checkbox", { name: "Enable Stored Materials Retainage" }),
    ).toBeChecked();

    fireEvent.change(screen.getByRole("spinbutton", { name: "Default Retainage Percent" }), {
      target: { value: "7.5" },
    });
    expect(
      screen.getByRole("spinbutton", { name: "Default Retainage Percent" }),
    ).toHaveValue(7.5);
  });
});
