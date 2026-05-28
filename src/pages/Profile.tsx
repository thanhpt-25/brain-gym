import { useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, KeyRound, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useAuthStore } from "@/stores/auth.store";
import {
  getMyProfile,
  updateProfile,
  uploadAvatar,
  changePassword,
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

  if (isLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <Navbar title="Profile" />
      <main id="main-content" className="container max-w-2xl px-4 pt-24 pb-20">
        <Tabs defaultValue="info">
          <TabsList className="w-full mb-8">
            <TabsTrigger value="info" className="flex-1 gap-2">
              <User className="h-4 w-4" /> Personal Info
            </TabsTrigger>
            <TabsTrigger value="security" className="flex-1 gap-2">
              <KeyRound className="h-4 w-4" /> Security
            </TabsTrigger>
          </TabsList>

          {/* Personal Info */}
          <TabsContent value="info">
            <div className="space-y-8">
              {/* Avatar */}
              <div className="flex flex-col items-center gap-3">
                <div className="relative group">
                  <Avatar className="h-24 w-24 ring-2 ring-border">
                    <AvatarImage src={avatarSrc} />
                    <AvatarFallback className="text-2xl font-mono bg-primary/10 text-primary">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadAvatarMutation.isPending}
                    className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Upload avatar"
                  >
                    <Camera className="h-6 w-6 text-white" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground font-mono">
                  {uploadAvatarMutation.isPending
                    ? "Uploading…"
                    : "Click to change avatar · Max 2 MB"}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Profile form */}
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

                <Button
                  type="submit"
                  className="w-full glow-cyan"
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? "Saving…" : "Save Changes"}
                </Button>
              </form>
            </div>
          </TabsContent>

          {/* Security */}
          <TabsContent value="security">
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
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
