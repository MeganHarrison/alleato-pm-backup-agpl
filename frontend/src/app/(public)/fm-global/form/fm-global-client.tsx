"use client";

import type { ReactElement } from "react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  submitFmGlobalSpecs,
  type FmPublicSubmissionMetadata,
} from "./actions";
import type { FmGlobalSpecInput } from "@/types/fm-global";
import {
  asrsEstimatorRequestSchema,
  parseOpenWidthSegments,
  type AsrsEstimatorRequest,
} from "@/lib/fmds/asrs-estimator";
import {
  FmGlobalForm,
  defaultFormState,
  CONTAINER_TYPE_OTHER,
  type FormState,
} from "./fm-global-form";

function toNumber(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface ValidatedPayload {
  evaluatorInput: AsrsEstimatorRequest;
  input: FmGlobalSpecInput;
  metadata: FmPublicSubmissionMetadata;
}

export function buildPayload(state: FormState): ValidatedPayload | string {
  const name = state.contactName.trim();
  const email = state.contactEmail.trim();
  const projectName = state.projectName.trim();
  const projectLocation = state.projectLocation.trim();

  if (!name) return "Please add your name.";
  if (!email) return "Please add your email.";
  if (!EMAIL_PATTERN.test(email)) {
    return "Please enter a valid email address.";
  }
  if (!projectName) return "Please add a project name.";

  const ceiling = toNumber(state.ceilingHeight);
  if (!ceiling) return "Ceiling height is required.";

  const kFactor = toNumber(state.kFactor);
  if (kFactor === undefined) {
    return "Please select the existing ceiling sprinkler K-factor.";
  }

  const designSprinklerCount = toNumber(state.designSprinklerCount);
  if (
    designSprinklerCount === undefined ||
    !Number.isInteger(designSprinklerCount) ||
    designSprinklerCount <= 0
  ) {
    return "Please enter a whole-number design sprinkler count greater than zero.";
  }

  let containerType: string | undefined;
  if (state.containerType === CONTAINER_TYPE_OTHER) {
    const other = state.containerTypeOther.trim();
    if (!other) return "Please describe the container type.";
    containerType = other;
  } else if (state.containerType && state.containerType !== "unspecified") {
    containerType = state.containerType;
  }

  const input: FmGlobalSpecInput = {
    asrs_type: state.asrsType as FmGlobalSpecInput["asrs_type"],
    system_type: "wet",
    ceiling_height_ft: ceiling,
    commodity_class: state.commodityClass || undefined,
    k_factor: kFactor,
    tolerance_ft: 5,
    container_type: containerType,
    storage_height_ft: toNumber(state.storageHeight),
    rack_row_depth_ft: toNumber(state.rackRowDepth),
    building_heated: true,
  };

  const metadata: FmPublicSubmissionMetadata = {
    contact_name: name,
    contact_email: email,
    project_name: projectName,
    project_location: projectLocation || undefined,
  };

  const parsedOpenWidths = parseOpenWidthSegments(state.openWidthsIn);
  if (parsedOpenWidths.error) return parsedOpenWidths.error;
  const transverseFlue = {
    openWidthsIn: parsedOpenWidths.values,
    horizontalUniformlyOpenPercent: toNumber(
      state.horizontalUniformlyOpenPercent,
    ),
    objectWidthIn: toNumber(state.objectWidthIn),
    objectAngleDegrees: toNumber(state.objectAngleDegrees),
    netWidthIn: toNumber(state.netWidthIn),
    nominalHorizontalDistanceFt: toNumber(state.nominalHorizontalDistanceFt),
    actualNetWidthIn: toNumber(state.actualNetWidthIn),
    ...(state.actualNetWidthIn.trim() ||
    state.nominalHorizontalDistanceFt.trim() ||
    state.verticallyAligned ||
    state.unobstructedFullHeight
      ? {
          verticallyAligned: state.verticallyAligned,
          unobstructedFullHeight: state.unobstructedFullHeight,
        }
      : {}),
    grossWidthBetweenUprightsIn: toNumber(state.grossWidthBetweenUprightsIn),
    netWidthBetweenUprightsIn: toNumber(state.netWidthBetweenUprightsIn),
    affectedFlueHorizontalDistanceFt: toNumber(
      state.affectedFlueHorizontalDistanceFt,
    ),
  };
  const hasTransverseFlueInput = Object.values(transverseFlue).some(
    (value) => value !== undefined,
  );
  const parsedEvaluatorInput = asrsEstimatorRequestSchema.safeParse({
    ceilingSprinklerType: state.ceilingSprinklerType,
    designSprinklerCount,
    transverseFlue: hasTransverseFlueInput ? transverseFlue : undefined,
  });
  if (!parsedEvaluatorInput.success) {
    return parsedEvaluatorInput.error.issues[0]?.message ?? "Check the entered values.";
  }
  const evaluatorInput: AsrsEstimatorRequest = parsedEvaluatorInput.data;

  return { evaluatorInput, input, metadata };
}

/**
 * Public client wrapper for the FM Global ASRS sprinkler form. Submits to the
 * server action and redirects to a confirmation page.
 */
export function FmGlobalClient({
  submissionPath = "/fm-global/form/submitted",
}: {
  submissionPath?: string;
}): ReactElement {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    setErrorMessage(null);
    const result = buildPayload(formState);
    if (typeof result === "string") {
      setErrorMessage(result);
      return;
    }

    startTransition(() => {
      void (async () => {
        try {
          const response = await submitFmGlobalSpecs(
            result.input,
            result.evaluatorInput,
            result.metadata,
          );
          router.push(`${submissionPath}/${response.submissionId}`);
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to submit your requirements. Please try again.",
          );
        }
      })();
    });
  };

  return (
    <FmGlobalForm
      formState={formState}
      onFormChange={setFormState}
      onSubmit={submit}
      isPending={isPending}
      errorMessage={errorMessage}
    />
  );
}
