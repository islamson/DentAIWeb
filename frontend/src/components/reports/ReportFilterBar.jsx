import { Filter, RotateCcw, Search as SearchIcon, SlidersHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { cn } from "../../lib/utils";
import { getOptionList } from "../../features/reports/reportUtils";

export function ReportFilterBar({
  title = "Filtreler",
  description = "Sonuçları rapor ihtiyacınıza göre daraltın.",
  fields = [],
  values = {},
  availableFilters = {},
  onValuesChange,
  onApply,
  onReset,
  compact = false,
  className,
}) {
  const activeFilterCount = Object.values(values || {}).filter(
    (value) => value !== undefined && value !== null && value !== ""
  ).length;

  const handleValueChange = (key, value) => {
    onValuesChange?.({
      ...values,
      [key]: value,
    });
  };

  return (
    <section className={cn("rounded-2xl border border-border/60 bg-card/80 p-4 shadow-sm backdrop-blur", className)}>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-primary/10 p-2 text-primary">
              <SlidersHorizontal className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            {activeFilterCount > 0 ? `${activeFilterCount} aktif filtre` : "Varsayılan görünüm"}
          </div>
          <Button size="sm" className="h-9 btn-primary-gradient" onClick={onApply}>
            <Filter className="mr-1.5 h-3.5 w-3.5" />
            Uygula
          </Button>
          <Button size="sm" variant="outline" className="h-9" onClick={onReset}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Temizle
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "mt-4 grid gap-3",
          compact ? "lg:grid-cols-6 md:grid-cols-3" : "xl:grid-cols-4 md:grid-cols-2"
        )}
      >
        {fields.map((field) => {
          const options = getOptionList(field, availableFilters);
          const commonLabelClass = "mb-1.5 block text-xs font-medium text-muted-foreground";

          if (field.type === "select") {
            return (
              <div key={field.key}>
                <label className={commonLabelClass}>{field.label}</label>
                <Select
                  value={values[field.key] || "__all__"}
                  onValueChange={(nextValue) =>
                    handleValueChange(field.key, nextValue === "__all__" ? "" : nextValue)
                  }
                >
                  <SelectTrigger className="h-10 rounded-xl">
                    <SelectValue placeholder={field.label} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">Tümü</SelectItem>
                    {options.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          if (field.type === "number") {
            return (
              <div key={field.key}>
                <label className={commonLabelClass}>{field.label}</label>
                <Input
                  type="number"
                  min={field.min}
                  max={field.max}
                  step={field.step || 1}
                  value={values[field.key] || ""}
                  onChange={(event) => handleValueChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className="h-10 rounded-xl"
                />
              </div>
            );
          }

          return (
            <div key={field.key}>
              <label className={commonLabelClass}>{field.label}</label>
              <div className="relative">
                {field.type === "search" && (
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                )}
                <Input
                  type={field.type === "date" ? "date" : "text"}
                  value={values[field.key] || ""}
                  onChange={(event) => handleValueChange(field.key, event.target.value)}
                  placeholder={field.placeholder}
                  className={cn("h-10 rounded-xl", field.type === "search" && "pl-9")}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
