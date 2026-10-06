import { Outlet, useLocation, Link } from "react-router-dom";
import { Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { cn } from "@/lib/utils.ts";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import {
  LayoutDashboard,
  BookOpen,
  Brain,
  ShieldCheck,
  LogOut,
  GraduationCap,
  Menu,
  X,
  ChevronRight,
  Building2,
  MessageSquare,
  Library,
  CreditCard,
  DollarSign,
  Palette,
  ChevronDown,
  ArrowLeftRight,
  Home,
  FolderKanban,
  Bell,
  BellOff,
  Sun,
  Moon,
  Video,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/hooks/use-auth.ts";
import { Button } from "@/components/ui/button.tsx";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import OrgOnboarding from "@/pages/org/OrgOnboarding.tsx";
import OrgChooser, { ORG_CHOSEN_KEY } from "@/pages/app/OrgChooser.tsx";
import { toast } from "sonner";
import type { Id } from "@/convex/_generated/dataModel.d.ts";
import { useConvexAuth } from "convex/react";
import { usePushNotifications } from "@/hooks/usePushNotifications.ts";

const ROLE_COLORS: Record<string, string> = {
  superadmin: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  admin: "bg-amber-500/20 text-amber-600 dark:text-amber-400",
  lecturer: "bg-primary/15 text-primary",
  student: "bg-accent/20 text-accent-foreground",
};

// ── Real-time clock ───────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="px-3 py-2 mx-3 mb-2 rounded-lg bg-sidebar-accent border border-sidebar-border/50 text-center">
      <p className="text-sidebar-foreground/90 font-mono text-sm font-semibold tabular-nums">
        {time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>
      <p className="text-sidebar-foreground/50 text-[10px] mt-0.5">
        {time.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
      </p>
    </div>
  );
}

function OrgSwitcher({ currentOrgId }: { currentOrgId?: string }) {
  const memberships = useQuery(api.organizations.getMyMemberships, {});
  const switchOrg = useMutation(api.organizations.switchActiveOrg);
  const [open, setOpen] = useState(false);

  if (!memberships || memberships.length === 0) return null;

  const handleSwitch = async (orgId: string) => {
    try {
      await switchOrg({ orgId: orgId as Id<"organizations"> });
      toast.success("Switched organization — dashboard updated");
      setOpen(false);
      // No reload needed — switchActiveOrg updates orgId reactively
    } catch {
      toast.error("Failed to switch organization");
    }
  };

  return (
    <div className="px-3 mb-2 relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all cursor-pointer"
      >
        <ArrowLeftRight className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left truncate">Switch Organization</span>
        <ChevronDown className={cn("w-3.5 h-3.5 flex-shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute bottom-full left-3 right-3 mb-1 bg-sidebar border border-sidebar-border rounded-xl shadow-lg z-50 overflow-hidden">
          {memberships.map((m) => {
            const isActive = m.orgId === (currentOrgId ?? "");
            return (
              <button
                key={m.orgId}
                onClick={() => handleSwitch(m.orgId)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 text-xs text-left cursor-pointer transition-colors",
                  isActive
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent"
                )}
              >
                <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{m.orgName}</p>
                  <p className="text-[10px] opacity-70 capitalize">{m.role}</p>
                </div>
                {isActive && <ChevronRight className="w-3 h-3 flex-shrink-0" />}
              </button>
            );
          })}
          <Link
            to="/institutions"
            className="w-full flex items-center gap-2 px-3 py-2.5 text-xs text-sidebar-primary hover:bg-sidebar-accent border-t border-sidebar-border cursor-pointer"
          >
            <Building2 className="w-3.5 h-3.5" /> Join another institution
          </Link>
        </div>
      )}
    </div>
  );
}

function ThemeSidebarToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all cursor-pointer mb-1"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-chart-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
      {theme === "dark" ? "Light Mode" : "Dark Mode"}
    </button>
  );
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  const location = useLocation();
  const { signout } = useAuth();
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const org = useQuery(api.organizations.getMyOrganization, {});
  const { isAuthenticated } = useConvexAuth();
  const { status: notifStatus, subscribe: notifSubscribe, unsubscribe: notifUnsubscribe } = usePushNotifications(isAuthenticated);

  const isAdminOrSuper = currentUser?.role === "admin" || currentUser?.role === "superadmin";
  const isLecturerOrAdmin = currentUser?.role === "lecturer" || isAdminOrSuper;

  // Apply org theme on load
  useEffect(() => {
    if (org?.theme) {
      try {
        const saved = JSON.parse(org.theme) as { presetId?: string; vars?: Record<string, string> };
        if (saved.vars && Object.keys(saved.vars).length > 0) {
          Object.entries(saved.vars).forEach(([key, val]) => {
            document.documentElement.style.setProperty(key, val);
          });
        }
      } catch {
        // ignore
      }
    }
  }, [org?.theme]);

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/courses", label: "Courses", icon: BookOpen },
    { href: "/programs", label: "Programs", icon: FolderKanban },
    ...(isLecturerOrAdmin
      ? [{ href: "/quizzes", label: "Quiz Bank", icon: Brain }]
      : [{ href: "/my-quizzes", label: "My Quizzes", icon: Brain }]),
    { href: "/live", label: "Live Classes", icon: Video },
    { href: "/forum", label: "Forum", icon: MessageSquare },
    { href: "/library", label: "Library", icon: Library },
    ...(isAdminOrSuper ? [
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/org-admin", label: "Org Admin", icon: Building2 },
      { href: "/theme", label: "Theme", icon: Palette },
    ] : []),
    ...(currentUser?.role === "superadmin" ? [
      { href: "/admin", label: "Platform Admin", icon: ShieldCheck },
      { href: "/superadmin/billing", label: "Platform Billing", icon: DollarSign },
    ] : []),
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Logo + org name */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-sidebar-border">
        <Link to="/" onClick={onClose} className="flex items-center gap-3 min-w-0 hover:opacity-80 transition-opacity cursor-pointer">
        <div className="w-9 h-9 rounded-xl bg-sidebar-primary flex items-center justify-center overflow-hidden flex-shrink-0">
          {org?.logoUrl ? (
            <img src={org.logoUrl} alt={org.name} className="w-full h-full object-cover" />
          ) : (
            <GraduationCap className="w-5 h-5 text-sidebar-primary-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="font-bold text-sidebar-foreground text-sm leading-tight truncate">
            {org?.name ?? "RitTutor LMS"}
          </p>
          <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">
            {org ? org.type ?? "Learning Platform" : "Learning Platform"}
          </p>
        </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = location.pathname === href;
          return (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer group",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span>{label}</span>
              {active && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-70" />}
            </Link>
          );
        })}
      </nav>

      {/* Clock */}
      <LiveClock />

      {/* Org Switcher */}
      <OrgSwitcher currentOrgId={currentUser?.orgId as string | undefined} />

      {/* User */}
      <div className="px-3 pb-4 border-t border-sidebar-border pt-3">
        {currentUser && (
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-sidebar-accent mb-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src={currentUser.avatar} />
              <AvatarFallback className="text-xs bg-sidebar-primary text-sidebar-primary-foreground">
                {currentUser.name?.charAt(0) ?? "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-sidebar-foreground truncate">{currentUser.name ?? "User"}</p>
              <span className={cn("text-[10px] font-medium capitalize px-1.5 py-0.5 rounded", ROLE_COLORS[currentUser.role ?? "student"])}>
                {currentUser.role ?? "student"}
              </span>
            </div>
          </div>
        )}
        <ThemeSidebarToggle />
        <Link
          to="/"
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all cursor-pointer mb-1"
          onClick={onClose}
        >
          <Home className="w-4 h-4" />
          Go to Homepage
        </Link>
        {notifStatus !== "unsupported" && notifStatus !== "iframe" && (
          <button
            onClick={() => {
              if (notifStatus === "subscribed") {
                notifUnsubscribe().then(() => toast.success("Notifications disabled"));
              } else if (notifStatus === "denied") {
                toast.error("Notifications blocked. Enable in your browser's site settings.");
              } else {
                notifSubscribe().then((r) => {
                  if ("subscribed" in r && r.subscribed) toast.success("Notifications enabled!");
                });
              }
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all cursor-pointer mb-1"
          >
            {notifStatus === "subscribed" ? <Bell className="w-4 h-4 text-primary" /> : <BellOff className="w-4 h-4" />}
            {notifStatus === "subscribed" ? "Notifications On" : notifStatus === "denied" ? "Notifications Blocked" : "Enable Notifications"}
          </button>
        )}
        <button
          onClick={() => {
            // Next sign-in must ask which institution to open
            sessionStorage.removeItem(ORG_CHOSEN_KEY);
            void signout();
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent rounded-lg transition-all cursor-pointer"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  );
}

function AppLayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const memberships = useQuery(api.organizations.getMyMemberships, {});
  const [chosen, setChosen] = useState(() => sessionStorage.getItem(ORG_CHOSEN_KEY) === "1");

  // People in several institutions pick one each session
  if (!chosen && memberships && memberships.length > 1) {
    return <OrgChooser currentOrgId={currentUser?.orgId as string | undefined} onDone={() => setChosen(true)} />;
  }

  // Show org onboarding if user has no orgId and is not a platform admin (superadmin or legacy admin)
  if (currentUser !== undefined && !currentUser?.orgId && currentUser?.role !== "superadmin" && currentUser?.role !== "admin") {
    return <OrgOnboarding />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-sidebar border-r border-sidebar-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-sidebar flex flex-col">
            <div className="absolute top-3 right-3">
              <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg text-sidebar-foreground/60 hover:text-sidebar-foreground cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <SidebarContent onClose={() => setSidebarOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background/80 backdrop-blur sticky top-0 z-10">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg hover:bg-muted cursor-pointer">
            <Menu className="w-5 h-5" />
          </button>
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer">
            <GraduationCap className="w-5 h-5 text-primary" />
            <span className="font-bold text-sm">RitTutor LMS</span>
          </Link>
        </header>

        <div className="flex-1 p-4 md:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function AppLayout() {
  return (
    <>
      <AuthLoading>
        <div className="min-h-screen flex items-center justify-center">
          <Skeleton className="h-screen w-full" />
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background">
          <GraduationCap className="w-12 h-12 text-primary" />
          <h2 className="text-xl font-bold">Sign in to access RitTutor LMS</h2>
          <p className="text-muted-foreground text-sm">You need to be signed in to continue</p>
          <SignInButton />
        </div>
      </Unauthenticated>
      <Authenticated>
        <AppLayoutInner />
      </Authenticated>
    </>
  );
}
