import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UNITS_OF_MEASURE } from "@/constants/budget";

interface UomSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
}

/**
 * Unit of Measure selector component
 * Provides a dropdown for selecting construction units of measure
 */
export function UomSelect({ value, onValueChange, className }: UomSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {UNITS_OF_MEASURE.map((uom) => (
          <SelectItem key={uom.code} value={uom.code}>
            {uom.code} - {uom.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
