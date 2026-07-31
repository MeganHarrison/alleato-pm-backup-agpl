"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  useForm,
  useWatch,
  type Control,
  type FieldPath,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronsUpDown,
  ClipboardList,
  LayoutList,
  Mail,
  PackageCheck,
  ShieldAlert,
  Timer,
  Truck,
  Users,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import {
  saveDailyLogWithCoreSections,
  updateDailyLogWithCoreSections,
  type DailyLogStatus,
} from "@/app/(main)/actions/daily-log-actions";
import { FormContainer, PageShell } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FormSection } from "@/components/forms/FormSection";
import { FormGrid } from "@/components/forms/FormGrid";
import { FormActions } from "@/components/forms/FormActions";
import { FormServerError } from "@/components/forms/FormServerError";
import { RHFTextField } from "@/components/forms/fields/RHFTextField";
import { RHFTextareaField } from "@/components/forms/fields/RHFTextareaField";
import { RHFSelectField } from "@/components/forms/fields/RHFSelectField";
import { RHFNumberField } from "@/components/forms/fields/RHFNumberField";
import { RHFCheckboxField } from "@/components/forms/fields/RHFCheckboxField";
import { RHFDateField } from "@/components/forms/fields/RHFDateField";
import { RHFTimeField } from "@/components/forms/fields/RHFTimeField";
import { RHFFieldArrayTable } from "@/components/forms/fields/RHFFieldArrayTable";
import { RHFFieldArrayRows } from "@/components/forms/fields/RHFFieldArrayRows";
import { buildOptions } from "@/components/forms/utils/buildOptions";
import { InfoAlert } from "@/components/ds/InfoAlert";
import { useProjectCompanies } from "@/hooks/use-project-companies";
import { cn } from "@/lib/utils";

// ─────────────────────────────────────────────────────────────────────────────
// Schema
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_VALUES = ["draft", "pending", "complete"] as const;

const STATUS_OPTIONS = buildOptions(STATUS_VALUES, {
  draft: "Draft",
  pending: "Pending",
  complete: "Complete",
});

// Row fields are permissive: empty rows are legal in the form and are filtered
// out at submit (matching the original hand-rolled behavior). `.catch()` keeps
// validation from ever blocking submit — a cleared numeric input becomes null
// rather than a NaN validation error, which the server action already
// normalizes to null via `cleanNumber`.
const weatherRowSchema = z.object({
  id: z.string(),
  area: z.string().catch(""),
  timeObserved: z.string().catch(""),
  delay: z.boolean().catch(false),
  location: z.string().catch(""),
  sky: z.string().catch(""),
  temperature: z.number().nullable().catch(null),
  calamity: z.string().catch(""),
  average: z.string().catch(""),
  precipitation: z.string().catch(""),
  wind: z.string().catch(""),
  groundOrSea: z.string().catch(""),
  comments: z.string().catch(""),
});

const manpowerRowSchema = z.object({
  id: z.string(),
  area: z.string().catch(""),
  trade: z.string().catch(""),
  workersCount: z.number().catch(0),
  hoursWorked: z.number().nullable().catch(null),
  costCode: z.string().catch(""),
  location: z.string().catch(""),
  comments: z.string().catch(""),
  issueFlag: z.boolean().catch(false),
});

const equipmentRowSchema = z.object({
  id: z.string(),
  area: z.string().catch(""),
  equipmentName: z.string().catch(""),
  hoursOperated: z.number().nullable().catch(null),
  hoursIdle: z.number().nullable().catch(null),
  costCode: z.string().catch(""),
  location: z.string().catch(""),
  inspected: z.boolean().catch(false),
  inspectionTime: z.string().catch(""),
  comments: z.string().catch(""),
});

const noteRowSchema = z.object({
  id: z.string(),
  area: z.string().catch(""),
  category: z.string().catch(""),
  location: z.string().catch(""),
  description: z.string().catch(""),
  issueFlag: z.boolean().catch(false),
});

const dailyLogFormSchema = z.object({
  logDate: z.string().trim().min(1, "Daily log date is required."),
  status: z.enum(STATUS_VALUES),
  generalNotes: z.string().catch(""),
  weather: z.array(weatherRowSchema),
  manpower: z.array(manpowerRowSchema),
  equipment: z.array(equipmentRowSchema),
  notes: z.array(noteRowSchema),
});

type DailyLogFormValues = z.infer<typeof dailyLogFormSchema>;

type WeatherRow = DailyLogFormValues["weather"][number];
type ManpowerRow = DailyLogFormValues["manpower"][number];
type EquipmentRow = DailyLogFormValues["equipment"][number];
type NoteRow = DailyLogFormValues["notes"][number];

const pendingSections = [
  { label: "Timecards", icon: Timer },
  { label: "Visitors", icon: Users },
  { label: "Phone Calls", icon: Mail },
  { label: "Inspections", icon: ClipboardList },
  { label: "Deliveries", icon: Truck },
  { label: "Safety Violations", icon: ShieldAlert },
  { label: "Accidents", icon: AlertTriangle },
  { label: "Quantities", icon: PackageCheck },
  { label: "Productivity", icon: CheckCircle2 },
  { label: "Dumpster", icon: Truck },
  { label: "Waste", icon: Truck },
  { label: "Scheduled Work", icon: CalendarDays },
  { label: "Photos", icon: PackageCheck },
  { label: "Delays", icon: Timer },
  { label: "Emails", icon: Mail },
];

function newId() {
  return crypto.randomUUID();
}

function emptyWeather(): WeatherRow {
  return {
    id: newId(),
    area: "All Areas",
    timeObserved: "09:00",
    delay: false,
    location: "",
    sky: "",
    temperature: null,
    calamity: "",
    average: "",
    precipitation: "",
    wind: "",
    groundOrSea: "",
    comments: "",
  };
}

function emptyManpower(): ManpowerRow {
  return {
    id: newId(),
    area: "All Areas",
    trade: "",
    workersCount: 0,
    hoursWorked: 0,
    costCode: "",
    location: "",
    comments: "",
    issueFlag: false,
  };
}

function emptyEquipment(): EquipmentRow {
  return {
    id: newId(),
    area: "All Areas",
    equipmentName: "",
    hoursOperated: 0,
    hoursIdle: 0,
    costCode: "",
    location: "",
    inspected: false,
    inspectionTime: "",
    comments: "",
  };
}

function emptyNote(): NoteRow {
  return {
    id: newId(),
    area: "All Areas",
    category: "",
    location: "",
    description: "",
    issueFlag: false,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Company / trade combobox (free-text-with-suggestions, wired into RHF)
// ─────────────────────────────────────────────────────────────────────────────

interface TradeOption {
  id: string;
  name: string;
}

function TradeCombobox({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: TradeOption[];
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const filtered = React.useMemo(
    () =>
      search
        ? options.filter((opt) => opt.name.toLowerCase().includes(search.toLowerCase()))
        : options,
    [options, search],
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && search.trim() && search.trim() !== value) {
      onChange(search.trim());
    }
    if (!nextOpen) setSearch("");
    setOpen(nextOpen);
  };

  const handleSelect = (companyName: string) => {
    onChange(companyName);
    setSearch("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn(
            "h-8 w-full min-w-[140px] justify-between text-sm font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || "Select or type..."}</span>
          <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search project directory..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            {filtered.length === 0 ? (
              <CommandEmpty>
                {search.trim() ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-xs"
                    onClick={() => handleSelect(search.trim())}
                  >
                    Use &quot;{search.trim()}&quot;
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No companies found.</span>
                )}
              </CommandEmpty>
            ) : (
              <CommandGroup>
                {filtered.map((opt) => (
                  <CommandItem
                    key={opt.id}
                    value={opt.name}
                    onSelect={() => handleSelect(opt.name)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-3.5 w-3.5",
                        value === opt.name ? "opacity-100" : "opacity-0",
                      )}
                    />
                    {opt.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function RHFTradeCombobox({
  control,
  name,
  label,
  options,
}: {
  control: Control<DailyLogFormValues>;
  name: FieldPath<DailyLogFormValues>;
  label: string;
  options: TradeOption[];
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex flex-col">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <TradeCombobox
              value={typeof field.value === "string" ? field.value : ""}
              onChange={field.onChange}
              options={options}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function ManpowerRowTotal({
  control,
  rowName,
}: {
  control: Control<DailyLogFormValues>;
  rowName: `manpower.${number}`;
}) {
  const workers = useWatch({ control, name: `${rowName}.workersCount` });
  const hours = useWatch({ control, name: `${rowName}.hoursWorked` });
  const workerCount = Number.isFinite(workers as number) ? Number(workers) : 0;
  const hourCount = Number.isFinite(hours as number) ? Number(hours) : 0;
  return <span className="tabular-nums text-sm">{workerCount * hourCount}</span>;
}

// ─────────────────────────────────────────────────────────────────────────────

export type DailyLogInitialData = {
  dailyLogId: string;
  logDate: string;
  status: DailyLogStatus;
  generalNotes: string;
  weather: WeatherRow[];
  manpower: ManpowerRow[];
  equipment: EquipmentRow[];
  notes: NoteRow[];
};

interface DailyLogFormClientProps {
  projectId: number;
  mode: "create" | "edit";
  initialData?: DailyLogInitialData;
}

export function DailyLogFormClient({ projectId, mode, initialData }: DailyLogFormClientProps) {
  const router = useRouter();
  const today = new Date().toISOString().split("T")[0];
  const [quickLog, setQuickLog] = React.useState(false);

  const { companies } = useProjectCompanies(String(projectId), { per_page: 500 });
  const tradeOptions: TradeOption[] = React.useMemo(
    () =>
      companies
        .filter((c) => c.company?.name)
        .map((c) => ({ id: c.company_id, name: c.company!.name })),
    [companies],
  );

  const form = useForm<DailyLogFormValues>({
    resolver: zodResolver(dailyLogFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      logDate: initialData?.logDate ?? today,
      status: initialData?.status ?? "draft",
      generalNotes: initialData?.generalNotes ?? "",
      weather:
        initialData?.weather && initialData.weather.length > 0
          ? initialData.weather
          : [emptyWeather()],
      manpower:
        initialData?.manpower && initialData.manpower.length > 0
          ? initialData.manpower
          : [emptyManpower()],
      equipment:
        initialData?.equipment && initialData.equipment.length > 0
          ? initialData.equipment
          : [emptyEquipment()],
      notes:
        initialData?.notes && initialData.notes.length > 0
          ? initialData.notes
          : [emptyNote()],
    },
  });

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting, errors },
  } = form;

  const watchedManpower = useWatch({ control, name: "manpower" });
  const manpowerTotals = React.useMemo(() => {
    return (watchedManpower ?? []).reduce(
      (totals, row) => {
        const workers = Number.isFinite(row?.workersCount as number)
          ? Number(row?.workersCount)
          : 0;
        const hours = Number.isFinite(row?.hoursWorked as number)
          ? Number(row?.hoursWorked)
          : 0;
        return {
          workers: totals.workers + workers,
          hours: totals.hours + workers * hours,
        };
      },
      { workers: 0, hours: 0 },
    );
  }, [watchedManpower]);

  const backPath = `/${projectId}/daily-log`;
  const title = mode === "edit" ? "Edit Daily Log" : "Daily Log";
  const saveLabel = mode === "edit" ? "Save Changes" : "Save Log";

  async function onSubmit(data: DailyLogFormValues) {
    const weather = data.weather.filter((row) =>
      Boolean(row.sky || row.temperature || row.precipitation || row.wind || row.comments),
    );
    const manpower = data.manpower.filter((row) => row.workersCount > 0);
    const equipment = data.equipment.filter((row) => row.equipmentName.trim());
    const notes = data.notes.filter((row) => row.description.trim());

    let result: { error?: string };

    if (mode === "edit" && initialData?.dailyLogId) {
      result = await updateDailyLogWithCoreSections(initialData.dailyLogId, {
        projectId,
        logDate: data.logDate,
        status: data.status,
        generalNotes: data.generalNotes,
        weather,
        manpower,
        equipment,
        notes,
      });
    } else {
      result = await saveDailyLogWithCoreSections({
        projectId,
        logDate: data.logDate,
        status: data.status,
        generalNotes: data.generalNotes,
        weather,
        manpower,
        equipment,
        notes,
      });
    }

    if (result.error) {
      setError("root", { type: "server", message: result.error });
      toast.error(result.error);
      return;
    }

    toast.success(mode === "edit" ? "Daily log updated" : "Daily log saved");
    router.push(backPath);
  }

  return (
    <PageShell
      variant="form"
      title={title}
      description="Daily field record by date"
      onBack={() => router.push(backPath)}
      backLabel="Back to Daily Log"
      actions={
        <Button
          variant="outline"
          size="sm"
          type="button"
          onClick={() => setQuickLog((value) => !value)}
        >
          {quickLog ? (
            <>
              <LayoutList className="mr-1 h-3.5 w-3.5" />
              Full Log
            </>
          ) : (
            <>
              <Zap className="mr-1 h-3.5 w-3.5" />
              Quick Log
            </>
          )}
        </Button>
      }
    >
      <FormContainer maxWidth="xl" withCard={false}>
        <Form {...form}>
          <form noValidate onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {quickLog && (
              <InfoAlert
                variant="info"
                icon={<Zap className="mt-px h-3.5 w-3.5 shrink-0" />}
                className="items-center py-2 text-xs"
              >
                Quick Log — showing Weather, Manpower, and Notes only. Switch to Full Log to
                access all sections.
              </InfoAlert>
            )}

            <FormSection title="Log Details">
              <FormGrid columns={3}>
                <RHFDateField control={control} name="logDate" label="Date *" />

                <RHFSelectField
                  control={control}
                  name="status"
                  label="Status"
                  options={STATUS_OPTIONS}
                />

                <RHFTextField
                  control={control}
                  name="generalNotes"
                  label="General Notes"
                  placeholder="Overall daily summary"
                />
              </FormGrid>
            </FormSection>

            <FormSection title="Observed Weather Conditions">
              <RHFFieldArrayTable
                control={control}
                name="weather"
                addLabel="Add Weather Row"
                createRow={emptyWeather}
                columns={[
                  {
                    key: "area",
                    header: "Area",
                    mobileLabel: "Area",
                    cell: ({ rowName }) => (
                      <RHFTextField control={control} name={`${rowName}.area`} label="Area" />
                    ),
                  },
                  {
                    key: "timeObserved",
                    header: "Time",
                    mobileLabel: "Time",
                    cell: ({ rowName }) => (
                      <RHFTimeField
                        control={control}
                        name={`${rowName}.timeObserved`}
                        label="Time"
                      />
                    ),
                  },
                  {
                    key: "delay",
                    header: "Delay",
                    mobileLabel: "Delay",
                    cell: ({ rowName }) => (
                      <RHFCheckboxField
                        control={control}
                        name={`${rowName}.delay`}
                        label="Delay"
                        hideLabel
                      />
                    ),
                  },
                  {
                    key: "location",
                    header: "Location",
                    mobileLabel: "Location",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.location`}
                        label="Location"
                      />
                    ),
                  },
                  {
                    key: "sky",
                    header: "Sky",
                    mobileLabel: "Sky",
                    className: "min-w-32",
                    cell: ({ rowName }) => (
                      <RHFTextField control={control} name={`${rowName}.sky`} label="Sky" />
                    ),
                  },
                  {
                    key: "temperature",
                    header: "Temp",
                    mobileLabel: "Temp",
                    cell: ({ rowName }) => (
                      <RHFNumberField
                        control={control}
                        name={`${rowName}.temperature`}
                        label="Temp"
                        step={1}
                      />
                    ),
                  },
                  {
                    key: "precipitation",
                    header: "Precipitation",
                    mobileLabel: "Precipitation",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.precipitation`}
                        label="Precipitation"
                      />
                    ),
                  },
                  {
                    key: "wind",
                    header: "Wind",
                    mobileLabel: "Wind",
                    cell: ({ rowName }) => (
                      <RHFTextField control={control} name={`${rowName}.wind`} label="Wind" />
                    ),
                  },
                  {
                    key: "comments",
                    header: "Comments",
                    mobileLabel: "Comments",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.comments`}
                        label="Comments"
                      />
                    ),
                  },
                ]}
              />
            </FormSection>

            <FormSection
              title="Manpower"
              description={`${manpowerTotals.workers} workers / ${manpowerTotals.hours} total hours`}
            >
              <RHFFieldArrayTable
                control={control}
                name="manpower"
                addLabel="Add Manpower Row"
                createRow={emptyManpower}
                columns={[
                  {
                    key: "area",
                    header: "Area",
                    mobileLabel: "Area",
                    cell: ({ rowName }) => (
                      <RHFTextField control={control} name={`${rowName}.area`} label="Area" />
                    ),
                  },
                  {
                    key: "trade",
                    header: "Company / Trade",
                    mobileLabel: "Company / Trade",
                    className: "min-w-[180px]",
                    cell: ({ rowName }) => (
                      <RHFTradeCombobox
                        control={control}
                        name={`${rowName}.trade`}
                        label="Company / Trade"
                        options={tradeOptions}
                      />
                    ),
                  },
                  {
                    key: "workersCount",
                    header: "Workers",
                    mobileLabel: "Workers",
                    className: "w-[140px]",
                    cell: ({ rowName }) => (
                      <RHFNumberField
                        control={control}
                        name={`${rowName}.workersCount`}
                        label="Workers"
                        min={0}
                        step={1}
                      />
                    ),
                  },
                  {
                    key: "hoursWorked",
                    header: "Hours",
                    mobileLabel: "Hours",
                    className: "w-[140px]",
                    cell: ({ rowName }) => (
                      <RHFNumberField
                        control={control}
                        name={`${rowName}.hoursWorked`}
                        label="Hours"
                        min={0}
                        step={0.25}
                      />
                    ),
                  },
                  {
                    key: "total",
                    header: "Total",
                    mobileLabel: "Total",
                    cell: ({ rowName }) => (
                      <ManpowerRowTotal control={control} rowName={rowName} />
                    ),
                  },
                  {
                    key: "costCode",
                    header: "Cost Code",
                    mobileLabel: "Cost Code",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.costCode`}
                        label="Cost Code"
                      />
                    ),
                  },
                  {
                    key: "location",
                    header: "Location",
                    mobileLabel: "Location",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.location`}
                        label="Location"
                      />
                    ),
                  },
                  {
                    key: "comments",
                    header: "Comments",
                    mobileLabel: "Comments",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.comments`}
                        label="Comments"
                      />
                    ),
                  },
                  {
                    key: "issueFlag",
                    header: "Issue",
                    mobileLabel: "Issue",
                    cell: ({ rowName }) => (
                      <RHFCheckboxField
                        control={control}
                        name={`${rowName}.issueFlag`}
                        label="Issue"
                        hideLabel
                      />
                    ),
                  },
                ]}
              />
            </FormSection>

            <FormSection title="Notes">
              <RHFFieldArrayRows
                control={control}
                name="notes"
                addLabel="Add Note"
                createRow={emptyNote}
                columns={[
                  {
                    key: "area",
                    className: "sm:max-w-[140px]",
                    cell: ({ rowName }) => (
                      <RHFTextField control={control} name={`${rowName}.area`} label="Area" />
                    ),
                  },
                  {
                    key: "category",
                    className: "sm:max-w-[180px]",
                    cell: ({ rowName }) => (
                      <RHFTextField
                        control={control}
                        name={`${rowName}.category`}
                        label="Category"
                        placeholder="Category"
                      />
                    ),
                  },
                  {
                    key: "description",
                    cell: ({ rowName }) => (
                      <RHFTextareaField
                        control={control}
                        name={`${rowName}.description`}
                        label="Comment"
                        placeholder="Comment"
                        rows={2}
                      />
                    ),
                  },
                  {
                    key: "issueFlag",
                    className: "sm:max-w-[120px]",
                    cell: ({ rowName }) => (
                      <RHFCheckboxField
                        control={control}
                        name={`${rowName}.issueFlag`}
                        label="Issue"
                        hideLabel
                      />
                    ),
                  },
                ]}
              />
            </FormSection>

            {!quickLog && (
              <>
                <FormSection title="Equipment">
                  <RHFFieldArrayTable
                    control={control}
                    name="equipment"
                    addLabel="Add Equipment Row"
                    createRow={emptyEquipment}
                    columns={[
                      {
                        key: "area",
                        header: "Area",
                        mobileLabel: "Area",
                        cell: ({ rowName }) => (
                          <RHFTextField
                            control={control}
                            name={`${rowName}.area`}
                            label="Area"
                          />
                        ),
                      },
                      {
                        key: "equipmentName",
                        header: "Equipment",
                        mobileLabel: "Equipment",
                        className: "min-w-[180px]",
                        cell: ({ rowName }) => (
                          <RHFTextField
                            control={control}
                            name={`${rowName}.equipmentName`}
                            label="Equipment"
                          />
                        ),
                      },
                      {
                        key: "hoursOperated",
                        header: "Operating",
                        mobileLabel: "Operating",
                        className: "w-[140px]",
                        cell: ({ rowName }) => (
                          <RHFNumberField
                            control={control}
                            name={`${rowName}.hoursOperated`}
                            label="Operating"
                            min={0}
                            step={0.25}
                          />
                        ),
                      },
                      {
                        key: "hoursIdle",
                        header: "Idle",
                        mobileLabel: "Idle",
                        className: "w-[140px]",
                        cell: ({ rowName }) => (
                          <RHFNumberField
                            control={control}
                            name={`${rowName}.hoursIdle`}
                            label="Idle"
                            min={0}
                            step={0.25}
                          />
                        ),
                      },
                      {
                        key: "costCode",
                        header: "Cost Code",
                        mobileLabel: "Cost Code",
                        cell: ({ rowName }) => (
                          <RHFTextField
                            control={control}
                            name={`${rowName}.costCode`}
                            label="Cost Code"
                          />
                        ),
                      },
                      {
                        key: "location",
                        header: "Location",
                        mobileLabel: "Location",
                        cell: ({ rowName }) => (
                          <RHFTextField
                            control={control}
                            name={`${rowName}.location`}
                            label="Location"
                          />
                        ),
                      },
                      {
                        key: "inspected",
                        header: "Inspected",
                        mobileLabel: "Inspected",
                        cell: ({ rowName }) => (
                          <RHFCheckboxField
                            control={control}
                            name={`${rowName}.inspected`}
                            label="Inspected"
                            hideLabel
                          />
                        ),
                      },
                      {
                        key: "comments",
                        header: "Comments",
                        mobileLabel: "Comments",
                        cell: ({ rowName }) => (
                          <RHFTextField
                            control={control}
                            name={`${rowName}.comments`}
                            label="Comments"
                          />
                        ),
                      },
                    ]}
                  />
                </FormSection>

                <FormSection
                  title="Additional Sections"
                  description={`${pendingSections.length} sections available`}
                >
                  <div className="divide-y divide-border/70">
                    {pendingSections.map(({ label, icon: Icon }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between gap-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{label}</span>
                        </div>
                        <span className="text-xs text-destructive">Coming soon</span>
                      </div>
                    ))}
                  </div>
                </FormSection>
              </>
            )}

            <FormServerError message={errors.root?.message} />

            <FormActions
              onCancel={() => router.push(backPath)}
              isSubmitting={isSubmitting}
              submitLabel={saveLabel}
              stickyOnMobile
            />
          </form>
        </Form>
      </FormContainer>
    </PageShell>
  );
}
