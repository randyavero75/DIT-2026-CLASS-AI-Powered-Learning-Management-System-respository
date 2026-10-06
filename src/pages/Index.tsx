import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { SignInButton } from "@/components/ui/signin.tsx";
import { Authenticated, Unauthenticated } from "convex/react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Input } from "@/components/ui/input.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { useTheme } from "next-themes";
import {
  GraduationCap,
  Brain,
  BookOpen,
  Users,
  Zap,
  CheckCircle2,
  Star,
  ArrowRight,
  FileText,
  Target,
  BarChart3,
  Search,
  Building2,
  Globe,
  ChevronRight,
  Sun,
  Moon,
} from "lucide-react";

const FEATURES = [
{
  icon: Brain,
  title: "AI-Powered Quiz Generation",
  desc: "Upload any PDF and our AI instantly generates intelligent, multi-choice quiz questions tailored to the content.",
  color: "text-primary bg-primary/10"
},
{
  icon: Target,
  title: "Instant Auto-Grading",
  desc: "Students get real-time feedback and scores the moment they submit. No waiting, no manual marking.",
  color: "text-accent bg-accent/15"
},
{
  icon: BarChart3,
  title: "Performance Analytics",
  desc: "Track student progress, quiz performance, and learning outcomes with detailed dashboards.",
  color: "text-chart-1 bg-chart-1/10"
},
{
  icon: BookOpen,
  title: "Course Management",
  desc: "Organize courses, modules, and quizzes in one place. Students enroll and access everything easily.",
  color: "text-chart-2 bg-chart-2/10"
},
{
  icon: Users,
  title: "Role-Based Access",
  desc: "Admins, Lecturers, and Students each get a tailored experience. Admins approve lecturer access to AI tools.",
  color: "text-chart-4 bg-chart-4/10"
},
{
  icon: FileText,
  title: "Quiz Bank",
  desc: "Every quiz is saved and organized in a searchable bank. Reuse, edit, and publish quizzes anytime.",
  color: "text-chart-5 bg-chart-5/10"
}];


const STEPS = [
{ step: "01", title: "Lecturer Uploads PDF", desc: "Any lecture note, textbook chapter, or document.", img: "https://hercules-cdn.com/file_EXOXeWbvjx55ZB1DwxgcAYnU" },
{ step: "02", title: "AI Generates Quiz", desc: "Our AI reads the content and creates multiple-choice questions with explanations.", img: null },
{ step: "03", title: "Publish to Students", desc: "Assign the quiz to a course. Students get notified instantly.", img: null },
{ step: "04", title: "Results & Grades", desc: "Auto-marked, scored, and stored. Review detailed performance reports.", img: "https://hercules-cdn.com/file_fxIXPnNJDyMngPFcjj8edBmC" }];


const TYPE_LABELS: Record<string, string> = {
  university: "University",
  school: "School",
  senior_high_school: "Senior High School",
  junior_high_school: "Junior High School",
  bible_school: "Bible School",
  polytechnic: "Polytechnic",
  technical: "Technical Institute",
  nursing: "Nursing School",
  vocational: "Vocational",
  business: "Business",
  other: "Other"
};

const TYPE_COLORS: Record<string, string> = {
  university: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  school: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  senior_high_school: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  junior_high_school: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
  bible_school: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  polytechnic: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  technical: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300",
  nursing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
  vocational: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  business: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  other: "bg-muted text-muted-foreground"
};

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="p-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors cursor-pointer border border-border"
      title="Toggle day/night mode"
    >
      {theme === "dark" ? (
        <Sun className="w-4 h-4 text-chart-4" />
      ) : (
        <Moon className="w-4 h-4 text-primary" />
      )}
    </button>
  );
}

function InstitutionsSection() {
  const [search, setSearch] = useState("");
  const orgs = useQuery(api.orgInviteRequests.listPublicOrganizations, {});

  const filtered = (orgs ?? []).filter((o) =>
  o.name.toLowerCase().includes(search.toLowerCase()) ||
  o.description?.toLowerCase().includes(search.toLowerCase()) ||
  o.type?.toLowerCase().includes(search.toLowerCase())
  );

  const preview = filtered.slice(0, 6);

  return (
    <section className="py-20 md:py-28 bg-muted/20 relative overflow-hidden">
      {/* Decorative blobs */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute top-10 left-0 w-72 h-72 bg-accent/8 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}>
            
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-4 border border-accent/20">
              <Building2 className="w-3.5 h-3.5" />
              Join an Institution
            </div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Find Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                Institution
              </span>
            </h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Browse registered schools, universities, and organizations. Request an enrollment code to join and start learning with AI-powered quizzes.
            </p>
          </motion.div>
        </div>

        {/* Search bar */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="relative max-w-lg mx-auto mb-10">
          
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search by name, type, or description..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-11 text-sm shadow-sm" />
          
        </motion.div>

        {/* Institution cards */}
        {orgs === undefined ?
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}
          </div> :
        preview.length === 0 ?
        <div className="text-center py-16 text-muted-foreground">
            <Building2 className="w-12 h-12 mx-auto mb-4 opacity-25" />
            <p className="font-medium">
              {search ? "No institutions match your search." : "No institutions registered yet."}
            </p>
          </div> :

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {preview.map((org, i) =>
          <motion.div
            key={org._id}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: i * 0.06 }}
            className="bg-card border border-border rounded-2xl p-5 hover:shadow-lg hover:-translate-y-0.5 transition-all group">
            
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/15 transition-colors">
                    <Building2 className="w-5 h-5 text-primary" />
                  </div>
                  {org.type &&
              <Badge className={`text-xs shrink-0 ${TYPE_COLORS[org.type] ?? TYPE_COLORS.other}`}>
                      {TYPE_LABELS[org.type] ?? org.type}
                    </Badge>
              }
                </div>
                <h3 className="font-semibold text-sm mb-1.5 leading-snug">{org.name}</h3>
                {org.description &&
            <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mb-3">{org.description}</p>
            }
                {org.website &&
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="w-3 h-3" />
                    <span className="truncate">{org.website.replace(/^https?:\/\//, "")}</span>
                  </div>
            }
              </motion.div>
          )}
          </div>
        }

        {/* View all CTA */}
        {orgs && orgs.length > 0 &&
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.3 }}
          className="flex flex-col items-center gap-2">
          
            {orgs.length > 6 &&
          <p className="text-sm text-muted-foreground">
                Showing {preview.length} of {filtered.length} institution{filtered.length !== 1 ? "s" : ""}
              </p>
          }
            <Link to="/institutions">
              <Button className="cursor-pointer gap-2 mt-2">
                View All Institutions
                <ChevronRight className="w-4 h-4" />
              </Button>
            </Link>
          </motion.div>
        }
      </div>
    </section>);

}

export default function Index() {
  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Navbar */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center">
              <GraduationCap className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">RitTutor LMS</span>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/institutions">
              <Button size="sm" variant="ghost" className="cursor-pointer hidden sm:flex gap-1.5">
                <Building2 className="w-3.5 h-3.5" />
                Find Institutions
              </Button>
            </Link>
            <Authenticated>
              <Link to="/dashboard">
                <Button size="sm" className="cursor-pointer">
                  Go to Dashboard <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </Authenticated>
            <Unauthenticated>
              <SignInButton />
            </Unauthenticated>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute top-20 right-1/4 w-72 h-72 bg-accent/15 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-chart-2/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}>
              
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-6 border border-primary/20">
                <Zap className="w-3.5 h-3.5" />
                AI-Powered Learning Management System
              </div>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-balance leading-[1.1]">
              
              The Future of{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                Academic Assessment
              </span>{" "}
              is Here
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg text-muted-foreground mt-6 max-w-2xl mx-auto text-balance">
              
              RitTutor LMS empowers lecturers to generate intelligent quizzes from PDFs using AI, auto-grade student submissions, and track learning progress — all in one platform.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              
              <Unauthenticated>
                <SignInButton />
              </Unauthenticated>
              <Authenticated>
                <Link to="/dashboard">
                  <Button size="lg" className="cursor-pointer w-full sm:w-auto">
                    Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </Authenticated>
              <Link to="/institutions">
                <Button size="lg" variant="secondary" className="cursor-pointer gap-2">
                  <Building2 className="w-4 h-4" />
                  Find Institutions
                </Button>
              </Link>
            </motion.div>

            {/* Trust badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="flex flex-wrap justify-center gap-4 mt-10 text-sm text-muted-foreground">
              
              {["Free to get started", "AI-generated quizzes", "Instant grading", "Role-based access"].map((t) =>
              <div key={t} className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-accent" />
                  {t}
                </div>
              )}
            </motion.div>
          </div>

          {/* Hero image — main classroom shot */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="mt-16 max-w-5xl mx-auto relative">
            
            <div className="rounded-2xl overflow-hidden border border-border shadow-2xl shadow-primary/10">
              <img
                src="https://hercules-cdn.com/file_9n9KpnmOWYh1FZjWkF26IeqR"
                alt="Students using RitTutor LMS in a modern computer lab"
                className="w-full h-64 sm:h-96 object-cover object-center" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-background/50 via-transparent to-transparent" />
            </div>

            {/* Floating stat cards */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.9 }}
              className="absolute -bottom-5 -left-4 sm:left-6 bg-card border border-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Brain className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Quizzes Generated</p>
                <p className="font-bold text-base">10,000+</p>
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 1.0 }}
              className="absolute -bottom-5 -right-4 sm:right-6 bg-card border border-border rounded-2xl shadow-xl px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center">
                <GraduationCap className="w-4.5 h-4.5 text-accent" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Active Students</p>
                <p className="font-bold text-base">5,000+</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="pt-24 pb-20 md:pt-28 md:pb-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold tracking-tight">
              
              Everything you need to{" "}
              <span className="text-primary">teach smarter</span>
            </motion.h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              A complete LMS powered by AI — built for modern institutions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color }, i) =>
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.07 }}
              className="bg-card border border-border rounded-2xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all">
              
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <h3 className="font-semibold text-base mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Visual showcase — two-image split */}
      <section className="py-20 md:py-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-5 border border-primary/20">
                <BookOpen className="w-3.5 h-3.5" />
                For Students
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Study smarter,{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">not harder</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Access all your courses and AI-generated quizzes from anywhere. Track your progress, review results, and prepare for exams with targeted practice.
              </p>
              <ul className="space-y-2.5">
                {["Instant quiz results and feedback", "Course materials organized by program", "Personal quiz history and scores"].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-accent flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}>
              <div className="rounded-2xl overflow-hidden border border-border shadow-xl">
                <img
                  src="https://hercules-cdn.com/file_8Y0y8IuDV2tUCbeDkUE1YaQ8"
                  alt="Student studying with RitTutor LMS"
                  className="w-full h-72 object-cover object-center" />
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center mt-20">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="order-2 md:order-1">
              <div className="rounded-2xl overflow-hidden border border-border shadow-xl">
                <img
                  src="https://hercules-cdn.com/file_7udo8174WKSU2AD5eW7qEO1l"
                  alt="RitTutor LMS dashboard on laptop"
                  className="w-full h-72 object-cover object-center" />
              </div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="order-1 md:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent text-xs font-semibold mb-5 border border-accent/20">
                <BarChart3 className="w-3.5 h-3.5" />
                For Educators
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">
                Powerful tools for{" "}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-primary">every educator</span>
              </h2>
              <p className="text-muted-foreground leading-relaxed mb-6">
                Lecturers and admins get a full dashboard — create courses, generate quizzes with AI, manage enrollments, and track every student's performance at a glance.
              </p>
              <ul className="space-y-2.5">
                {["AI quiz generation from any PDF", "Detailed analytics per course and student", "Bulk enrollment and program management"].map((item) => (
                  <li key={item} className="flex items-center gap-2.5 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold tracking-tight">
              
              From PDF to Quiz in{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">
                seconds
              </span>
            </motion.h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              A simple four-step workflow that transforms lecture materials into interactive assessments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {STEPS.map(({ step, title, desc, img }, i) =>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: i * 0.1 }}
              className="relative bg-card border border-border rounded-2xl p-5 hover:shadow-md transition-all">
              
                {img && (
                  <div className="rounded-xl overflow-hidden mb-4 -mx-1">
                    <img src={img} alt={title} className="w-full h-32 object-cover object-center" />
                  </div>
                )}
                <div className="text-4xl font-black text-primary/10 mb-2">{step}</div>
                <h3 className="font-bold text-base mb-1.5">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
                {i < STEPS.length - 1 &&
              <div className="hidden lg:block absolute top-8 -right-3 text-muted-foreground/30">
                    <ArrowRight className="w-5 h-5" />
                  </div>
              }
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* Social proof / testimonial banner */}
      <section className="py-16 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl overflow-hidden">
            <img
              src="https://hercules-cdn.com/file_fxIXPnNJDyMngPFcjj8edBmC"
              alt="Students collaborating with RitTutor LMS analytics"
              className="w-full h-64 md:h-80 object-cover object-center" />
            <div className="absolute inset-0 bg-gradient-to-r from-primary/80 to-accent/60" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              <p className="text-white font-bold text-xl md:text-3xl text-balance max-w-2xl">
                {'"'}RitTutor LMS has transformed how our institution conducts assessments. Students are more engaged and results are instant.{'"'}
              </p>
              <p className="text-white/70 mt-4 text-sm">— Academic Director, Partner University</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Find Institutions */}
      <InstitutionsSection />

      {/* Create / Join Institution CTA */}
      <section className="py-20 md:py-24 bg-muted/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <motion.h2
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
              className="text-3xl md:text-4xl font-bold tracking-tight"
            >
              Ready to get started?
            </motion.h2>
            <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
              Create your institution or join one using an invite code.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="bg-card border-2 border-border rounded-2xl p-7 hover:border-primary/50 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg mb-2">Create an Institution</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Register your school, university, or training center on RitTutor LMS. Set up courses, invite lecturers and students, and manage everything in one place.
              </p>
              <Authenticated>
                <Link to="/org-admin">
                  <Button className="cursor-pointer gap-2 w-full">
                    <Building2 className="w-4 h-4" />
                    Create Institution
                  </Button>
                </Link>
              </Authenticated>
              <Unauthenticated>
                <SignInButton />
              </Unauthenticated>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-card border-2 border-border rounded-2xl p-7 hover:border-accent/50 hover:shadow-md transition-all"
            >
              <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center mb-4">
                <GraduationCap className="w-6 h-6 text-accent" />
              </div>
              <h3 className="font-bold text-lg mb-2">Join an Institution</h3>
              <p className="text-sm text-muted-foreground mb-5">
                Have an invite code? Sign in and use it to join your institution on RitTutor LMS. Or browse the institutions list to find yours and request to join.
              </p>
              <div className="flex flex-col gap-2">
                <Link to="/institutions">
                  <Button variant="secondary" className="cursor-pointer gap-2 w-full">
                    <ChevronRight className="w-4 h-4" />
                    Browse Institutions
                  </Button>
                </Link>
                <Authenticated>
                  <Link to="/dashboard">
                    <Button variant="ghost" className="cursor-pointer gap-2 w-full text-sm">
                      Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </Authenticated>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://hercules-cdn.com/file_LFuS6ZTXKQa2gbKAxwc8Aq2b"
            alt="RitTutor LMS"
            className="w-full h-full object-cover object-center" />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/90 via-primary/80 to-accent/70" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}>
            
            <GraduationCap className="w-12 h-12 text-white/80 mx-auto mb-5" />
            <h2 className="text-3xl md:text-4xl font-bold text-white text-balance">
              Ready to transform your teaching?
            </h2>
            <p className="text-white/70 mt-4 text-lg">
              Join today and start generating AI-powered quizzes from your lecture materials.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Unauthenticated>
                <SignInButton />
              </Unauthenticated>
              <Authenticated>
                <Link to="/dashboard">
                  <Button size="lg" variant="secondary" className="cursor-pointer w-full sm:w-auto">
                    Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </Authenticated>
              <Link to="/institutions">
                <Button size="lg" variant="ghost" className="cursor-pointer text-white border-white/30 border hover:bg-white/10 gap-2">
                  <Building2 className="w-4 h-4" />
                  Find Institutions
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <span className="font-bold text-sm">RitTutor LMS</span>
          </div>
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} RitTutor LMS. All rights reserved.
          </p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Star className="w-3 h-3 text-chart-4 fill-chart-4" />
              AI-Powered Learning
            </div>
            <ThemeToggle />
          </div>
        </div>
      </footer>
    </div>);

}
