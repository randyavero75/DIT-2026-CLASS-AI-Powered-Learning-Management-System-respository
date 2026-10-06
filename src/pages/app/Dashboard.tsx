import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Button } from "@/components/ui/button.tsx";
import {
  BookOpen, Brain, GraduationCap, Users, TrendingUp, CheckCircle,
  Award, BarChart2, Clock, Target, Sparkles, ArrowRight, Hash
} from "lucide-react";
import { Authenticated } from "convex/react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, RadialBarChart, RadialBar, Legend,
} from "recharts";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { motion } from "motion/react";

// ─── Shared helpers ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  sub,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  return (
    <Card className="border border-border shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</CardTitle>
      </CardHeader>
      <CardContent className="flex items-end justify-between pt-0">
        <div>
          <span className="text-3xl font-bold">{value}</span>
          {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
        </div>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color.replace("text-", "bg-").replace("primary", "primary/15").replace("accent", "accent/15")}`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold tracking-tight text-foreground">{children}</h2>;
}

// ─── Admin Dashboard ─────────────────────────────────────────────────────────

function AdminDashboard() {
  const stats = useQuery(api.analytics.getAdminStats, {});

  if (stats === undefined) return <DashboardSkeleton />;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="text-primary" sub={`${stats.studentCount} students · ${stats.lecturerCount} lecturers`} />
        <StatCard label="Courses" value={stats.totalCourses} icon={BookOpen} color="text-accent" sub={`${stats.publishedCourses} published`} />
        <StatCard label="Quizzes" value={stats.totalQuizzes} icon={Brain} color="text-chart-2" sub={`${stats.publishedQuizzes} published`} />
        <StatCard label="Avg. Score" value={`${stats.avgScore}%`} icon={TrendingUp} color="text-chart-4" sub={`${stats.passRate}% pass rate`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Course performance bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Course Performance</SectionTitle>
            <p className="text-xs text-muted-foreground">Average score per course</p>
          </CardHeader>
          <CardContent>
            {stats.coursePerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No data yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.coursePerformance} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 14) + "…" : v} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Avg Score"]} />
                  <Bar dataKey="avgScore" fill="#3b5bdb" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick summary radial */}
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Platform Summary</SectionTitle>
            <p className="text-xs text-muted-foreground">Overall platform health</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 py-2">
              {[
                { label: "Total Enrollments", value: stats.totalEnrollments, icon: GraduationCap },
                { label: "Total Attempts", value: stats.totalAttempts, icon: CheckCircle },
                { label: "Pass Rate", value: `${stats.passRate}%`, icon: Award },
                { label: "Avg. Score", value: `${stats.avgScore}%`, icon: Target },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold leading-none">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity */}
      <Card>
        <CardHeader className="pb-2">
          <SectionTitle>Recent Quiz Attempts</SectionTitle>
        </CardHeader>
        <CardContent>
          {stats.recentAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No attempts yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recentAttempts.map((a) => (
                <div key={a._id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.quizTitle} · {a.courseTitle}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-sm font-semibold">{a.percentage}%</span>
                    <Badge variant={a.passed ? "default" : "destructive"} className="text-xs">
                      {a.passed ? "Pass" : "Fail"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Lecturer Dashboard ──────────────────────────────────────────────────────

function LecturerDashboard() {
  const stats = useQuery(api.analytics.getLecturerStats, {});

  if (stats === undefined) return <DashboardSkeleton />;
  if (!stats) return null;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="My Courses" value={stats.courseCount} icon={BookOpen} color="text-primary" sub={`${stats.publishedCourses} published`} />
        <StatCard label="Quizzes" value={stats.quizCount} icon={Brain} color="text-accent" sub={`${stats.publishedQuizzes} published`} />
        <StatCard label="Students" value={stats.totalStudents} icon={GraduationCap} color="text-chart-2" sub="enrolled across courses" />
        <StatCard label="Avg. Score" value={`${stats.avgScore}%`} icon={TrendingUp} color="text-chart-4" sub={`${stats.passRate}% pass rate`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Quiz Performance</SectionTitle>
            <p className="text-xs text-muted-foreground">Attempts & avg score per quiz</p>
          </CardHeader>
          <CardContent>
            {stats.quizPerformance.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No quizzes yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={stats.quizPerformance} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="attempts" fill="#22b8cf" radius={[4, 4, 0, 0]} name="Attempts" />
                  <Bar dataKey="avgScore" fill="#3b5bdb" radius={[4, 4, 0, 0]} name="Avg Score %" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Overview</SectionTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 py-2">
              {[
                { label: "Total Attempts", value: stats.totalAttempts, icon: BarChart2 },
                { label: "Pass Rate", value: `${stats.passRate}%`, icon: CheckCircle },
                { label: "Avg. Score", value: `${stats.avgScore}%`, icon: Award },
                { label: "Published Quizzes", value: stats.publishedQuizzes, icon: Brain },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40">
                  <Icon className="w-4 h-4 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-lg font-bold leading-none">{value}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <SectionTitle>Recent Student Attempts</SectionTitle>
        </CardHeader>
        <CardContent>
          {stats.recentAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No attempts yet</p>
          ) : (
            <div className="space-y-2">
              {stats.recentAttempts.map((a) => (
                <div key={a._id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{a.studentName}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.quizTitle}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-sm font-semibold">{a.percentage}%</span>
                    <Badge variant={a.passed ? "default" : "destructive"} className="text-xs">
                      {a.passed ? "Pass" : "Fail"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Student Dashboard ───────────────────────────────────────────────────────

function FreshStudentWelcome() {
  const currentUser = useQuery(api.users.getCurrentUser, {});
  const org = useQuery(api.organizations.getMyOrganization, {});

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4"
    >
      {/* Icon */}
      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <GraduationCap className="w-10 h-10 text-primary" />
      </div>

      {/* Welcome heading */}
      <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-2">
        Welcome to{" "}
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
          {org?.name ?? "your institution"}
        </span>
          {currentUser?.name ? `, ${currentUser.name}` : ""}!
      </h1>

      {/* Index number badge */}
      {currentUser?.indexNumber && (
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 mb-4 text-sm font-mono font-semibold">
          <Hash className="w-3.5 h-3.5" />
          Student ID: {currentUser.indexNumber}
        </div>
      )}

      <p className="text-muted-foreground max-w-md text-sm sm:text-base mb-8">
        Your portal is fresh and ready. Browse available courses, request access, and start taking AI-powered quizzes.
      </p>

      {/* Quick action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-2xl mb-8">
        {[
          { icon: BookOpen, title: "Browse Courses", desc: "See all available courses in your institution", href: "/courses", color: "text-primary bg-primary/10" },
          { icon: Brain, title: "Take Quizzes", desc: "Start with quizzes once you enroll in a course", href: "/quizzes", color: "text-accent bg-accent/10" },
          { icon: Sparkles, title: "Community Forum", desc: "Connect with peers and ask questions", href: "/forum", color: "text-chart-2 bg-chart-2/10" },
        ].map(({ icon: Icon, title, desc, href, color }) => (
          <Link key={title} to={href}>
            <div className="group bg-card border border-border rounded-2xl p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer h-full">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
                <Icon className="w-4.5 h-4.5" />
              </div>
              <p className="font-semibold text-sm mb-1">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <Link to="/courses">
        <Button className="cursor-pointer gap-2">
          Browse Courses <ArrowRight className="w-4 h-4" />
        </Button>
      </Link>
    </motion.div>
  );
}

function StudentDashboard() {
  const stats = useQuery(api.analytics.getStudentStats, {});
  const currentUser = useQuery(api.users.getCurrentUser, {});

  if (stats === undefined) return <DashboardSkeleton />;
  if (!stats) return null;

  // Show fresh welcome screen for newly enrolled students with no data yet
  if (stats.isFreshMember) return <FreshStudentWelcome />;

  return (
    <div className="space-y-8">
      {/* Student ID badge */}
      {currentUser?.indexNumber && (
        <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-mono font-semibold">
          <Hash className="w-3.5 h-3.5" />
          Student ID: {currentUser.indexNumber}
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Enrolled Courses" value={stats.enrolledCourses} icon={BookOpen} color="text-primary" />
        <StatCard label="Quizzes Taken" value={stats.quizzesTaken} icon={Brain} color="text-accent" />
        <StatCard label="Avg. Score" value={`${stats.avgScore}%`} icon={TrendingUp} color="text-chart-2" sub="across all quizzes" />
        <StatCard label="Best Score" value={`${stats.bestScore}%`} icon={Award} color="text-chart-4" sub={`${stats.passCount} passed`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Score trend line chart */}
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Score Trend</SectionTitle>
            <p className="text-xs text-muted-foreground">Your last 6 quiz scores</p>
          </CardHeader>
          <CardContent>
            {stats.scoreTrend.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Take some quizzes to see your trend</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={stats.scoreTrend} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip formatter={(v: number) => [`${v}%`, "Score"]} />
                  <Line type="monotone" dataKey="score" stroke="#3b5bdb" strokeWidth={2} dot={{ r: 4, fill: "#3b5bdb" }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Course progress */}
        <Card>
          <CardHeader className="pb-2">
            <SectionTitle>Course Progress</SectionTitle>
            <p className="text-xs text-muted-foreground">Quizzes attempted per course</p>
          </CardHeader>
          <CardContent>
            {stats.courseProgress.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">Enroll in courses to track progress</p>
            ) : (
              <div className="space-y-3 py-2">
                {stats.courseProgress.map((c) => {
                  if (!c) return null;
                  const pct = c.total > 0 ? Math.round((c.attempted / c.total) * 100) : 0;
                  return (
                    <div key={c.name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium truncate max-w-[70%]">{c.name}</span>
                        <span className="text-muted-foreground text-xs">{c.attempted}/{c.total} quizzes</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent attempts */}
      <Card>
        <CardHeader className="pb-2">
          <SectionTitle>Recent Activity</SectionTitle>
        </CardHeader>
        <CardContent>
          {stats.recentAttempts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No quiz attempts yet. Head to My Quizzes to get started!</p>
          ) : (
            <div className="space-y-2">
              {stats.recentAttempts.map((a) => (
                <div key={a._id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.passed ? "bg-green-500/15" : "bg-destructive/15"}`}>
                      {a.passed ? <CheckCircle className="w-4 h-4 text-green-500" /> : <Clock className="w-4 h-4 text-destructive" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.quizTitle}</p>
                      <p className="text-xs text-muted-foreground">{a.courseTitle} · {a.completedAt ? format(new Date(a.completedAt), "MMM d") : ""}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    <span className="text-sm font-semibold">{a.percentage}%</span>
                    <Badge variant={a.passed ? "default" : "destructive"} className="text-xs">
                      {a.passed ? "Pass" : "Fail"}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-64" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

// ─── Main ────────────────────────────────────────────────────────────────────

function DashboardInner() {
  const currentUser = useQuery(api.users.getCurrentUser, {});

  if (currentUser === undefined) return <DashboardSkeleton />;

  const isAdmin = currentUser?.role === "admin";
  const isLecturer = currentUser?.role === "lecturer";
  const name = currentUser?.name?.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Welcome back, {name} 👋
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {isAdmin
            ? "Here's your platform overview."
            : isLecturer
            ? "Track your courses, quizzes, and student performance."
            : "Keep up the great work — here's how you're doing."}
        </p>
      </div>

      {isAdmin ? <AdminDashboard /> : isLecturer ? <LecturerDashboard /> : <StudentDashboard />}
    </div>
  );
}

export default function Dashboard() {
  return (
    <Authenticated>
      <DashboardInner />
    </Authenticated>
  );
}
