import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Authenticated } from "convex/react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Palette, Check } from "lucide-react";

type ThemePreset = {
  id: string;
  name: string;
  description: string;
  vars: Record<string, string>;
  preview: { bg: string; primary: string; accent: string };
};

// Predefined theme presets — stored as CSS variable values
const THEME_PRESETS: ThemePreset[] = [
  {
    id: "default",
    name: "RitTutor Default",
    description: "Deep navy & electric teal — the classic RitTutor LMS look",
    preview: { bg: "#0a0f1e", primary: "#00d4ff", accent: "#7c3aed" },
    vars: {},
  },
  {
    id: "forest",
    name: "Forest Green",
    description: "Calm green tones for focused learning",
    preview: { bg: "#f0fdf4", primary: "#16a34a", accent: "#84cc16" },
    vars: {
      "--background": "138 30% 97%",
      "--foreground": "138 30% 8%",
      "--primary": "142 72% 29%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "84 85% 35%",
      "--accent-foreground": "0 0% 100%",
      "--sidebar": "142 40% 12%",
      "--sidebar-foreground": "0 0% 95%",
      "--sidebar-primary": "142 72% 29%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-border": "142 30% 20%",
      "--sidebar-accent": "142 30% 18%",
    },
  },
  {
    id: "sunset",
    name: "Sunset Orange",
    description: "Warm, energetic orange palette",
    preview: { bg: "#fff7ed", primary: "#ea580c", accent: "#f59e0b" },
    vars: {
      "--background": "30 100% 97%",
      "--foreground": "24 10% 10%",
      "--primary": "22 90% 48%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "43 96% 56%",
      "--accent-foreground": "0 0% 10%",
      "--sidebar": "22 50% 12%",
      "--sidebar-foreground": "0 0% 95%",
      "--sidebar-primary": "22 90% 48%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-border": "22 30% 20%",
      "--sidebar-accent": "22 30% 18%",
    },
  },
  {
    id: "royal",
    name: "Royal Purple",
    description: "Rich purple for prestige and creativity",
    preview: { bg: "#faf5ff", primary: "#7c3aed", accent: "#db2777" },
    vars: {
      "--background": "270 40% 97%",
      "--foreground": "270 20% 8%",
      "--primary": "263 70% 50%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "330 81% 50%",
      "--accent-foreground": "0 0% 100%",
      "--sidebar": "263 50% 12%",
      "--sidebar-foreground": "0 0% 95%",
      "--sidebar-primary": "263 70% 50%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-border": "263 30% 20%",
      "--sidebar-accent": "263 30% 18%",
    },
  },
  {
    id: "slate",
    name: "Clean Slate",
    description: "Minimal grey tones, professional and clean",
    preview: { bg: "#f8fafc", primary: "#3b82f6", accent: "#06b6d4" },
    vars: {
      "--background": "210 40% 98%",
      "--foreground": "222 47% 11%",
      "--primary": "217 91% 60%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "189 94% 43%",
      "--accent-foreground": "0 0% 100%",
      "--sidebar": "222 47% 11%",
      "--sidebar-foreground": "0 0% 95%",
      "--sidebar-primary": "217 91% 60%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-border": "222 30% 20%",
      "--sidebar-accent": "222 30% 18%",
    },
  },
  {
    id: "crimson",
    name: "Crimson Bold",
    description: "Bold red for high-energy environments",
    preview: { bg: "#fff1f2", primary: "#e11d48", accent: "#f97316" },
    vars: {
      "--background": "351 100% 97%",
      "--foreground": "350 30% 8%",
      "--primary": "347 90% 50%",
      "--primary-foreground": "0 0% 100%",
      "--accent": "25 95% 53%",
      "--accent-foreground": "0 0% 100%",
      "--sidebar": "347 50% 12%",
      "--sidebar-foreground": "0 0% 95%",
      "--sidebar-primary": "347 90% 50%",
      "--sidebar-primary-foreground": "0 0% 100%",
      "--sidebar-border": "347 30% 20%",
      "--sidebar-accent": "347 30% 18%",
    },
  },
];

function applyThemeToDoc(vars: Record<string, string>) {
  const root = document.documentElement;
  if (Object.keys(vars).length === 0) {
    // Reset to default by removing overrides
    THEME_PRESETS.slice(1).forEach((p) => {
      Object.keys(p.vars).forEach((k) => root.style.removeProperty(k));
    });
    return;
  }
  Object.entries(vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
}

function ThemePageInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const org = useQuery(api.organizations.getMyOrganization, {});
  const updateTheme = useMutation(api.organizations.updateOrgTheme);
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string>("default");

  // Sync active id from saved theme
  useEffect(() => {
    if (org?.theme) {
      try {
        const saved = JSON.parse(org.theme) as { presetId: string; vars: Record<string, string> };
        setActiveId(saved.presetId ?? "default");
        applyThemeToDoc(saved.vars ?? {});
      } catch {
        // ignore
      }
    }
  }, [org?.theme]);

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
        <Palette className="w-12 h-12 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-bold">Admin Only</h2>
        <p className="text-muted-foreground">Only org admins can customize the theme.</p>
      </div>
    );
  }

  const handleSelect = (preset: ThemePreset) => {
    setActiveId(preset.id);
    applyThemeToDoc(preset.vars);
  };

  const handleSave = async () => {
    const preset = THEME_PRESETS.find((p) => p.id === activeId) ?? THEME_PRESETS[0];
    setSaving(true);
    try {
      await updateTheme({ theme: JSON.stringify({ presetId: preset.id, vars: preset.vars }) });
      toast.success(`Theme "${preset.name}" saved for your organization`);
    } catch {
      toast.error("Failed to save theme");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Theme Customization</h1>
        <p className="text-muted-foreground mt-1">Choose a color theme for your organization. Changes apply instantly for all your members.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {THEME_PRESETS.map((preset) => {
          const isActive = activeId === preset.id;
          return (
            <Card
              key={preset.id}
              className={`cursor-pointer border-2 transition-all hover:shadow-md ${isActive ? "border-primary ring-2 ring-primary/20" : "border-border hover:border-primary/40"}`}
              onClick={() => handleSelect(preset)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  {/* Color swatch preview */}
                  <div className="flex items-center gap-1.5">
                    <div className="w-8 h-8 rounded-lg border border-border flex-shrink-0" style={{ background: preset.preview.bg }} />
                    <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: preset.preview.primary }} />
                    <div className="w-6 h-6 rounded-full flex-shrink-0" style={{ background: preset.preview.accent }} />
                  </div>
                  {isActive && (
                    <Badge className="bg-primary/10 text-primary text-xs gap-1 flex-shrink-0">
                      <Check className="w-3 h-3" /> Active
                    </Badge>
                  )}
                </div>
                <CardTitle className="text-sm mt-2">{preset.name}</CardTitle>
                <CardDescription className="text-xs">{preset.description}</CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={handleSave} disabled={saving} className="cursor-pointer gap-2">
          <Palette className="w-4 h-4" />
          {saving ? "Saving..." : "Save Theme for Organization"}
        </Button>
        <p className="text-xs text-muted-foreground">Preview changes by clicking a theme, then save to apply for everyone.</p>
      </div>
    </div>
  );
}

export default function ThemePage() {
  return (
    <Authenticated>
      <ThemePageInner />
    </Authenticated>
  );
}
