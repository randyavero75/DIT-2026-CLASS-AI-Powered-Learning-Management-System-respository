import { Link } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Building2, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api.js";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { Button } from "@/components/ui/button.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";

export const ORG_CHOSEN_KEY = "org_chosen_this_session";

// Forget the choice whenever the person is signed out, however they got there
export function useResetOrgChoiceOnSignOut() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  if (!isLoading && !isAuthenticated) sessionStorage.removeItem(ORG_CHOSEN_KEY);
}

// Shown after sign-in when the person belongs to several institutions,
// so they pick where to go instead of landing in the last one used.
export default function OrgChooser({ currentOrgId, onDone }: { currentOrgId?: string; onDone: () => void }) {
  const memberships = useQuery(api.organizations.getMyMemberships, {});
  const switchOrg = useMutation(api.organizations.switchActiveOrg);

  const choose = async (orgId: string) => {
    try {
      if (orgId !== currentOrgId) await switchOrg({ orgId: orgId as Id<"organizations"> });
      sessionStorage.setItem(ORG_CHOSEN_KEY, "1");
      onDone();
    } catch {
      toast.error("Could not open this institution");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary mx-auto flex items-center justify-center">
            <GraduationCap className="w-6 h-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">Choose an institution</h1>
          <p className="text-sm text-muted-foreground">Select where you want to go for this session.</p>
        </div>
        <div className="space-y-2">
          {memberships === undefined ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)
          ) : (
            memberships.map((m) => (
              <button
                key={m.orgId}
                onClick={() => choose(m.orgId)}
                className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-card hover:bg-muted text-left cursor-pointer transition-colors"
              >
                <Building2 className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{m.orgName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{m.role}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <Link to="/institutions" className="block">
          <Button variant="secondary" className="w-full cursor-pointer">Join a different institution</Button>
        </Link>
      </div>
    </div>
  );
}
