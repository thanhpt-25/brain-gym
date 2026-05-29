import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  KeyRound,
  User,
  Trophy,
  Flame,
  Target,
  Sparkles,
  Award,
  TrendingUp,
  Calendar,
  Mail,
  Shield,
  Zap,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import {
  getMyProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
  getMyOverview,
} from "@/services/user";

const profileSchema = z.object({
  displayName: z.string().min(1, "Display name is required").max(100),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

const BADGE_ICONS: Record<string, string> = {
  "Early Bird": "🌅",
  "Marathon": "🔥",
  "Perfectionist": "💎",
  "Mentor": "🧠",
  "Speed Demon": "⚡",
  "Architect": "🏛️",
  "Exam Creator": "📝",
  "Cloud Master": "☁️",
  "Top Contributor": "🏆",
  "First Steps": "👣",
  "Dedicated Learner": "📚",
};

const CERT_ICONS: Record<string, string> = {
  "AWS": "☁️",
  "Azure": "🔷",
  "GCP": "🟢",
  "Kubernetes": "⚙️",
  "CKA": "⚙️",
};

const getActivityIcon = (type: string) => {
  switch (type) {
    case "exam_passed": return { icon: CheckCircle2, color: "text-accent" };
    case "badge_earned": return { icon: Award, color: "text-orange-400" };
    case "question_created": return { icon: Sparkles, color: "text-primary" };
    case "flashcard_reviewed": return { icon: Zap, color: "text-primary" };
    default: return { icon: Clock, color: "text-muted-foreground" };
  }
};

const getCertIcon = (code: string) => {
  for (const [key, icon] of Object.entries(CERT_ICONS)) {
    if (code.includes(key)) return icon;
  }
  return "📋";
};

export default function Profile() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user, setAuth, accessToken, refreshToken } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-profile"],
    queryFn: getMyProfile,
  });

  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ["my-overview"],
    queryFn: getMyOverview,
  });

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: { displayName: profile?.displayName ?? "" },
  });

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      if (user && accessToken && refreshToken) {
        setAuth(
          {
            ...user,
            displayName: updated.displayName,
            avatarUrl: updated.avatarUrl ?? user.avatarUrl,
          },
          accessToken,
          refreshToken,
        );
      }
      toast({ title: "Profile updated" });
    },
    onError: () =>
      toast({ title: "Failed to update profile", variant: "destructive" }),
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: uploadAvatar,
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["my-profile"] });
      if (user && accessToken && refreshToken) {
        setAuth(
          { ...user, avatarUrl: res.avatarUrl },
          accessToken,
          refreshToken,
        );
      }
      setAvatarPreview(null);
      toast({ title: "Avatar updated" });
    },
    onError: () =>
      toast({ title: "Failed to upload avatar", variant: "destructive" }),
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      passwordForm.reset();
      toast({ title: "Password changed successfully" });
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message ?? "Failed to change password";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarPreview(URL.createObjectURL(file));
    uploadAvatarMutation.mutate(file);
  };

  const initials = (profile?.displayName ?? user?.displayName ?? "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const avatarSrc = avatarPreview ?? profile?.avatarUrl ?? user?.avatarUrl;

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
  };

  const stats = overview?.stats
    ? [
        { label: "Total Points", value: overview.stats.totalPoints.toLocaleString(), icon: Trophy, accent: "text-primary", glow: "shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5)]" },
        { label: "Day Streak", value: overview.stats.dayStreak.toString(), icon: Flame, accent: "text-orange-400", glow: "shadow-[0_0_30px_-8px_hsl(25_95%_55%/0.4)]" },
        { label: "Exams Passed", value: overview.stats.examsPassed.toString(), icon: Target, accent: "text-accent", glow: "shadow-[0_0_30px_-8px_hsl(var(--accent)/0.4)]" },
        { label: "Avg. Score", value: `${overview.stats.avgScore}%`, icon: TrendingUp, accent: "text-primary", glow: "shadow-[0_0_30px_-8px_hsl(var(--primary)/0.5)]" },
      ]
    : [];

  const joinedDate = profile?.createdAt ? formatDate(profile.createdAt) : "Apr 2025";

  if (isLoading || overviewLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Profile" />
      <main id="main-content" className="container max-w-6xl px-4 pt-24 pb-20">
        {/* Hero header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative mb-8 overflow-hidden rounded-2xl border border-border/60"
        >
          {/* Banner */}
          <div className="relative h-40 sm:h-48 bg-gradient-to-br from-primary/20 via-background to-accent/20">
            <div
              className="absolute inset-0 opacity-40"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 20% 30%, hsl(var(--primary)/0.35), transparent 45%), radial-gradient(circle at 80% 70%, hsl(var(--accent)/0.25), transparent 45%)",
              }}
            />
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
          </div>

          {/* Identity row */}
          <div className="relative px-6 pb-6 pt-0 -mt-16 sm:-mt-20 sm:px-8">
            <div className="flex flex-col sm:flex-row sm:items-end gap-5">
              <div className="relative group shrink-0">
                <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-primary to-accent blur opacity-70" />
                <Avatar className="relative h-28 w-28 sm:h-32 sm:w-32 ring-4 ring-background">
                  <AvatarImage src={avatarSrc} />
                  <AvatarFallback className="text-3xl font-mono bg-card text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatarMutation.isPending}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Upload avatar"
                >
                  <Camera className="h-7 w-7 text-primary" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="font-mono text-2xl sm:text-3xl font-bold tracking-tight truncate">
                    {profile?.displayName ?? user?.displayName ?? "Athlete"}
                  </h1>
                  <Badge variant="outline" className="border-primary/40 text-primary bg-primary/5 capitalize">
                    <Shield className="h-3 w-3 mr-1" /> {profile?.plan ?? "Free"}
                  </Badge>
                  <Badge variant="outline" className="border-accent/40 text-accent bg-accent/5 capitalize">
                    {profile?.role ?? "Member"}
                  </Badge>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground font-mono">
                  <span className="inline-flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> {profile?.email}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Joined {joinedDate}
                  </span>
                </div>
              </div>

              <div className="sm:self-end shrink-0">
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAvatarMutation.isPending}
                  className="gap-2"
                >
                  <Camera className="h-4 w-4" />
                  {uploadAvatarMutation.isPending ? "Uploading…" : "Change Avatar"}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.05 * i }}
            >
              <Card className={`p-5 bg-card/60 backdrop-blur border-border/60 hover:border-primary/40 transition-all ${s.glow}`}>
                <div className="flex items-center justify-between mb-3">
                  <s.icon className={`h-5 w-5 ${s.accent}`} />
                  <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Lifetime
                  </span>
                </div>
                <div className="font-mono text-3xl font-bold">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Main grid */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: settings */}
          <div className="lg:col-span-2 space-y-6">
        <Tabs defaultValue="info">
          <TabsList className="w-full mb-6 bg-card/60 border border-border/60">
            <TabsTrigger value="info" className="flex-1 gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <User className="h-4 w-4" /> Personal Info
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1 gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <KeyRound className="h-4 w-4" /> Security
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex-1 gap-2 data-[state=active]:bg-primary/10 data-[state=active]:text-primary">
              <Clock className="h-4 w-4" /> Activity
            </TabsTrigger>
          </TabsList>

          {/* Personal Info */}
          <TabsContent value="info">
            <Card className="p-6 bg-card/60 border-border/60">
              <form
                onSubmit={profileForm.handleSubmit((data) =>
                  updateProfileMutation.mutate(data),
                )}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profile?.email ?? ""}
                    disabled
                    className="bg-muted/40 font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    {...profileForm.register("displayName")}
                    className="font-mono text-sm"
                  />
                  {profileForm.formState.errors.displayName && (
                    <p className="text-xs text-destructive">
                      {profileForm.formState.errors.displayName.message}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Role</Label>
                    <Input
                      value={profile?.role ?? ""}
                      disabled
                      className="bg-muted/40 font-mono text-sm capitalize"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Plan</Label>
                    <Input
                      value={profile?.plan ?? ""}
                      disabled
                      className="bg-muted/40 font-mono text-sm capitalize"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full glow-cyan bg-primary hover:bg-primary/90 text-primary-foreground font-mono"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </form>
            </Card>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
            <Card className="p-6 bg-card/60 border-border/60">
            <form
              onSubmit={passwordForm.handleSubmit((data) =>
                changePasswordMutation.mutate({
                  currentPassword: data.currentPassword,
                  newPassword: data.newPassword,
                }),
              )}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  {...passwordForm.register("currentPassword")}
                  className="font-mono text-sm"
                />
                {passwordForm.formState.errors.currentPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.currentPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  {...passwordForm.register("newPassword")}
                  className="font-mono text-sm"
                />
                {passwordForm.formState.errors.newPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.newPassword.message}
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  {...passwordForm.register("confirmPassword")}
                  className="font-mono text-sm"
                />
                {passwordForm.formState.errors.confirmPassword && (
                  <p className="text-xs text-destructive">
                    {passwordForm.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="outline"
                disabled={changePasswordMutation.isPending}
              >
                {changePasswordMutation.isPending
                  ? "Updating…"
                  : "Change Password"}
              </Button>
            </form>
            </Card>
          </TabsContent>

          {/* Activity */}
          <TabsContent value="activity">
            <Card className="p-6 bg-card/60 border-border/60">
              <h3 className="font-mono text-sm uppercase tracking-widest text-muted-foreground mb-5">
                Recent activity
              </h3>
              <div className="relative">
                <div className="absolute left-[19px] top-2 bottom-2 w-px bg-border" />
                <ul className="space-y-5">
                  {(overview?.activity ?? []).map((a, i) => {
                    const { icon: ActivityIcon, color } = getActivityIcon(a.type);
                    return (
                      <li key={i} className="relative flex gap-4">
                        <div className="relative z-10 shrink-0 h-10 w-10 rounded-full bg-card border border-border/60 flex items-center justify-center">
                          <ActivityIcon className={`h-5 w-5 ${color}`} />
                        </div>
                        <div className="pt-1.5">
                          <div className="font-medium">{a.title}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">{a.meta}</div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
          </div>

          {/* Right rail */}
          <aside className="space-y-6">
            {/* Certifications in progress */}
            <Card className="p-6 bg-card/60 border-border/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                  Certifications
                </h3>
                <Badge variant="outline" className="border-primary/40 text-primary text-[10px]">
                  {overview?.certs.length ?? 0} active
                </Badge>
              </div>
              <ul className="space-y-4">
                {(overview?.certs ?? []).map((c) => (
                  <li key={c.code}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="flex items-center gap-2 text-sm font-mono">
                        <span>{getCertIcon(c.code)}</span>
                        {c.code}
                      </span>
                      <span className="text-xs text-muted-foreground">{c.progress}%</span>
                    </div>
                    <Progress value={c.progress} className="h-1.5" />
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1">
                      {c.mastery}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Achievements */}
            <Card className="p-6 bg-card/60 border-border/60">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-sm uppercase tracking-widest text-muted-foreground">
                  Achievements
                </h3>
                <span className="text-xs text-muted-foreground font-mono">
                  {overview?.badges.filter((b) => b.earned).length ?? 0}/{overview?.badges.length ?? 0}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {(overview?.badges ?? []).map((b) => (
                  <div
                    key={b.id}
                    className={`group relative aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 p-2 text-center transition-all ${
                      b.earned
                        ? "border-primary/30 bg-primary/5 hover:border-primary/60 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.5)]"
                        : "border-border/40 bg-muted/20 opacity-50 grayscale"
                    }`}
                    title={b.description}
                  >
                    <div className="text-2xl">{BADGE_ICONS[b.name] ?? "🏆"}</div>
                    <div className="text-[10px] font-mono leading-tight">{b.name}</div>
                  </div>
                ))}
              </div>
            </Card>
          </aside>
        </div>
      </main>
    </div>
  );
}
