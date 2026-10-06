import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Label } from "@/components/ui/label.tsx";
import { CURRENCY_META } from "@/convex/lib/currency.ts";

const EDITABLE = ["USD", "EUR", "GBP"] as const;

export default function RatesCard() {
  const rates = useQuery(api.payments.getRates, {});
  const updateRates = useMutation(api.payments.updateRates);
  const [draft, setDraft] = useState<Partial<Record<(typeof EDITABLE)[number], string>>>({});
  const [saving, setSaving] = useState(false);

  if (!rates) return null;

  const value = (c: (typeof EDITABLE)[number]) => draft[c] ?? String(rates[c]);

  const handleSave = async () => {
    const parsed = { USD: Number(value("USD")), EUR: Number(value("EUR")), GBP: Number(value("GBP")) };
    if (Object.values(parsed).some((n) => !(n > 0))) {
      toast.error("Enter valid rates");
      return;
    }
    setSaving(true);
    try {
      await updateRates(parsed);
      setDraft({});
      toast.success("Exchange rates updated");
    } catch {
      toast.error("Could not update rates");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Exchange rates</CardTitle>
        <CardDescription>
          How many Ghana Cedis (GHS) equal one unit of each currency. Used to convert plan prices at checkout.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {EDITABLE.map((c) => (
            <div key={c} className="space-y-1.5">
              <Label htmlFor={`fx-${c}`}>1 {c} ({CURRENCY_META[c].name}) in GHS</Label>
              <Input
                id={`fx-${c}`}
                type="number"
                min={0}
                step="0.01"
                value={value(c)}
                onChange={(e) => setDraft((d) => ({ ...d, [c]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <Button className="cursor-pointer" disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : "Save rates"}
        </Button>
      </CardContent>
    </Card>
  );
}
