"use client";

import { useState, type FormEvent, type ReactElement } from "react";

import { ErrorState, SectionHeader } from "@/components/ds";
import { AsrsEstimatorResults } from "@/components/fm-global/asrs-estimator-results";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiFetch } from "@/lib/api-client";
import {
  asrsEstimatorRequestSchema,
  parseOpenWidthSegments,
  type AsrsEstimatorRequest,
  type AsrsEstimatorResponse,
} from "@/lib/fmds/asrs-estimator";

type FormState = {
  actualNetWidthIn: string;
  affectedFlueHorizontalDistanceFt: string;
  ceilingSprinklerType: AsrsEstimatorRequest["ceilingSprinklerType"];
  designSprinklerCount: string;
  grossWidthBetweenUprightsIn: string;
  horizontalUniformlyOpenPercent: string;
  netWidthBetweenUprightsIn: string;
  netWidthIn: string;
  nominalHorizontalDistanceFt: string;
  objectAngleDegrees: string;
  objectWidthIn: string;
  openWidthsIn: string;
  unobstructedFullHeight: boolean;
  verticallyAligned: boolean;
};

const initialForm: FormState = {
  actualNetWidthIn: "",
  affectedFlueHorizontalDistanceFt: "",
  ceilingSprinklerType: "standard_coverage",
  designSprinklerCount: "",
  grossWidthBetweenUprightsIn: "",
  horizontalUniformlyOpenPercent: "",
  netWidthBetweenUprightsIn: "",
  netWidthIn: "",
  nominalHorizontalDistanceFt: "",
  objectAngleDegrees: "",
  objectWidthIn: "",
  openWidthsIn: "",
  unobstructedFullHeight: false,
  verticallyAligned: false,
};

function optionalNumber(value: string): number | undefined {
  return value.trim() === "" ? undefined : Number(value);
}

function buildRequest(form: FormState): AsrsEstimatorRequest {
  const parsedOpenWidths = parseOpenWidthSegments(form.openWidthsIn);
  if (parsedOpenWidths.error) throw new Error(parsedOpenWidths.error);
  const transverseFlue = {
    openWidthsIn: parsedOpenWidths.values,
    horizontalUniformlyOpenPercent: optionalNumber(
      form.horizontalUniformlyOpenPercent,
    ),
    objectWidthIn: optionalNumber(form.objectWidthIn),
    objectAngleDegrees: optionalNumber(form.objectAngleDegrees),
    netWidthIn: optionalNumber(form.netWidthIn),
    nominalHorizontalDistanceFt: optionalNumber(
      form.nominalHorizontalDistanceFt,
    ),
    actualNetWidthIn: optionalNumber(form.actualNetWidthIn),
    ...(form.actualNetWidthIn.trim() ||
    form.nominalHorizontalDistanceFt.trim() ||
    form.verticallyAligned ||
    form.unobstructedFullHeight
      ? {
          verticallyAligned: form.verticallyAligned,
          unobstructedFullHeight: form.unobstructedFullHeight,
        }
      : {}),
    grossWidthBetweenUprightsIn: optionalNumber(
      form.grossWidthBetweenUprightsIn,
    ),
    netWidthBetweenUprightsIn: optionalNumber(form.netWidthBetweenUprightsIn),
    affectedFlueHorizontalDistanceFt: optionalNumber(
      form.affectedFlueHorizontalDistanceFt,
    ),
  };
  const hasTransverseFlueInput = Object.values(transverseFlue).some(
    (value) => value !== undefined,
  );

  const parsed = asrsEstimatorRequestSchema.safeParse({
    ceilingSprinklerType: form.ceilingSprinklerType,
    designSprinklerCount: Number(form.designSprinklerCount),
    transverseFlue: hasTransverseFlueInput ? transverseFlue : undefined,
  });
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ?? "Check the entered values.",
    );
  }
  return parsed.data;
}

function NumericField({
  id,
  label,
  value,
  onChange,
  step = "any",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
}): ReactElement {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <NumberInput
        id={id}
        min="0"
        step={step}
        decimals={step === "1" ? 0 : 2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

export function AsrsEstimator(): ReactElement {
  const [form, setForm] = useState<FormState>(initialForm);
  const [result, setResult] = useState<AsrsEstimatorResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const update = <Key extends keyof FormState>(
    key: Key,
    value: FormState[Key],
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    let request: AsrsEstimatorRequest;
    try {
      request = buildRequest(form);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Check the entered values.",
      );
      return;
    }

    setIsEvaluating(true);
    try {
      const response = await apiFetch<AsrsEstimatorResponse>(
        "/api/fm-global/estimator/evaluate",
        { method: "POST", body: JSON.stringify(request) },
      );
      setResult(response);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The ASRS configuration could not be evaluated.",
      );
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-10 lg:grid-cols-2 lg:gap-12"
    >
      <div className="min-w-0 space-y-10">
        <section className="space-y-5">
          <SectionHeader title="Sprinkler design" />
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ceiling-sprinkler-type">
                Ceiling sprinkler type
              </Label>
              <Select
                value={form.ceilingSprinklerType}
                onValueChange={(value) =>
                  update(
                    "ceilingSprinklerType",
                    value as FormState["ceilingSprinklerType"],
                  )
                }
              >
                <SelectTrigger id="ceiling-sprinkler-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard_coverage">
                    Standard coverage
                  </SelectItem>
                  <SelectItem value="extended_coverage">
                    Extended coverage
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <NumericField
              id="design-sprinkler-count"
              label="Design sprinkler count"
              value={form.designSprinklerCount}
              onChange={(value) => update("designSprinklerCount", value)}
              step="1"
            />
          </div>
        </section>

        <section className="space-y-5 border-t pt-8">
          <div className="space-y-1">
            <SectionHeader title="Transverse flue space" />
            <p className="text-sm text-muted-foreground">
              Optional inputs evaluate the reviewed flue-space rules that apply
              to this configuration.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="open-widths">Open width segments, in.</Label>
              <Input
                id="open-widths"
                placeholder="Example: 0.75, 1.25"
                value={form.openWidthsIn}
                onChange={(event) => update("openWidthsIn", event.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Separate multiple open segments with commas.
              </p>
            </div>
            <NumericField
              id="net-width"
              label="Net width, in."
              value={form.netWidthIn}
              onChange={(value) => update("netWidthIn", value)}
            />
            <NumericField
              id="horizontal-distance"
              label="Horizontal distance, ft"
              value={form.nominalHorizontalDistanceFt}
              onChange={(value) => update("nominalHorizontalDistanceFt", value)}
            />
            <NumericField
              id="actual-net-width"
              label="Actual net width, in."
              value={form.actualNetWidthIn}
              onChange={(value) => update("actualNetWidthIn", value)}
            />
            <div className="space-y-3 pt-1">
              <Label>Flue continuity</Label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox
                  checked={form.verticallyAligned}
                  onCheckedChange={(checked) =>
                    update("verticallyAligned", checked === true)
                  }
                />
                Vertically aligned
              </label>
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <Checkbox
                  checked={form.unobstructedFullHeight}
                  onCheckedChange={(checked) =>
                    update("unobstructedFullHeight", checked === true)
                  }
                />
                Unobstructed for full height
              </label>
            </div>
          </div>
        </section>

        <details className="border-t pt-6">
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-medium text-foreground">
            Obstruction and vertical-barrier inputs
          </summary>
          <div className="grid gap-5 pt-5 sm:grid-cols-2">
            <NumericField
              id="uniformly-open-percent"
              label="Uniformly open area, %"
              value={form.horizontalUniformlyOpenPercent}
              onChange={(value) =>
                update("horizontalUniformlyOpenPercent", value)
              }
            />
            <div />
            <NumericField
              id="object-width"
              label="Object width, in."
              value={form.objectWidthIn}
              onChange={(value) => update("objectWidthIn", value)}
            />
            <NumericField
              id="object-angle"
              label="Object angle, degrees"
              value={form.objectAngleDegrees}
              onChange={(value) => update("objectAngleDegrees", value)}
            />
            <NumericField
              id="gross-upright-width"
              label="Gross width between uprights, in."
              value={form.grossWidthBetweenUprightsIn}
              onChange={(value) => update("grossWidthBetweenUprightsIn", value)}
            />
            <NumericField
              id="net-upright-width"
              label="Net width between uprights, in."
              value={form.netWidthBetweenUprightsIn}
              onChange={(value) => update("netWidthBetweenUprightsIn", value)}
            />
            <NumericField
              id="affected-distance"
              label="Affected flue distance, ft"
              value={form.affectedFlueHorizontalDistanceFt}
              onChange={(value) =>
                update("affectedFlueHorizontalDistanceFt", value)
              }
            />
          </div>
        </details>

        {error ? (
          <ErrorState
            title="Configuration not evaluated"
            error={error}
            className="py-4"
          />
        ) : null}

        <Button
          type="submit"
          size="lg"
          disabled={isEvaluating}
          className="w-full sm:w-auto"
        >
          {isEvaluating ? "Evaluating..." : "Evaluate configuration"}
        </Button>
      </div>

      <AsrsEstimatorResults result={result} />
    </form>
  );
}
