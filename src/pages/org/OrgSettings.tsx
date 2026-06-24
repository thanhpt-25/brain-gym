import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  Palette,
  CreditCard,
  Save,
  Upload,
  AlertTriangle,
  Loader2,
  X,
  FileText,
  Mail,
  Shield,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { useOrgStore } from "@/stores/org.store";
import { updateOrg, deleteOrg } from "@/services/organizations";
import {
  getEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
  type EmailTemplate,
  type EmailTrigger,
} from "@/services/email-templates";

// Only raster data URLs and HTTPS URLs are safe to use as <img src>.
// SVG data URLs can execute embedded JS; http:// is blocked to avoid
// mixed-content and open-redirect issues.
function isSafeLogoUrl(url: string): boolean {
  return (
    url.startsWith("https://") ||
    url.startsWith("data:image/jpeg") ||
    url.startsWith("data:image/png") ||
    url.startsWith("data:image/gif") ||
    url.startsWith("data:image/webp")
  );
}

const OrgSettings = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const clearOrg = useOrgStore((s) => s.clearOrg);
  const slug = currentOrg?.slug || "";

  const [orgName, setOrgName] = useState("");
  const [description, setDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState("");
  const logoFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (currentOrg) {
      setOrgName(currentOrg.name);
      setDescription(currentOrg.description || "");
      setIndustry(currentOrg.industry || "");
      setAccentColor(currentOrg.accentColor || "#00bcd4");
      setLogoUrl(currentOrg.logoUrl || "");
      const safeUrl =
        currentOrg.logoUrl && isSafeLogoUrl(currentOrg.logoUrl)
          ? currentOrg.logoUrl
          : "";
      setLogoPreview(safeUrl);
    }
  }, [currentOrg]);

  const handleLogoFile = (file: File) => {
    // Explicitly allow only safe raster formats; SVG is excluded because
    // data:image/svg+xml URLs can execute embedded JavaScript as <img src>.
    const ALLOWED_TYPES = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ];
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG, PNG, GIF, or WebP image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    // Use a blob URL for the <img> preview — browser-opaque, not tainted by
    // file content, so CodeQL cannot trace user data into src={}.
    // Use a FileReader data URL only for the API payload (logoUrl state).
    setLogoPreview(URL.createObjectURL(file));
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      updateOrg(slug, {
        name: orgName,
        description: description || undefined,
        industry: industry || undefined,
        accentColor: accentColor || undefined,
        logoUrl: logoUrl || undefined,
      }),
    onSuccess: () => {
      toast.success("Settings saved successfully");
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
      queryClient.invalidateQueries({ queryKey: ["my-orgs"] });
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.message || "Failed to save settings"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteOrg(slug),
    onSuccess: () => {
      toast.success("Organization deleted");
      clearOrg();
      navigate("/org");
    },
    onError: (err: any) =>
      toast.error(
        err?.response?.data?.message || "Failed to delete organization",
      ),
  });

  const handleDelete = () => {
    if (
      window.confirm(
        "Are you sure you want to delete this organization? This action cannot be undone.",
      )
    ) {
      deleteMutation.mutate();
    }
  };

  if (!currentOrg) return null;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-mono font-bold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground font-mono">
          Manage your organization's profile and preferences
        </p>
      </div>

      {/* General */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" /> General
          </CardTitle>
          <CardDescription className="text-xs">
            Basic organization details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-mono text-xs">Organization Name</Label>
              <Input
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="bg-muted border-border"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-mono text-xs">Slug</Label>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-mono">
                  /{currentOrg.slug}
                </span>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Slug cannot be changed
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Description</Label>
            <Input
              placeholder="Brief description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Industry</Label>
            <Input
              placeholder="Technology, Finance..."
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="bg-muted border-border"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs">Logo</Label>
            <div className="flex items-start gap-4">
              {/* Preview or drop zone */}
              <div
                className={`h-20 w-20 rounded-xl border-2 flex items-center justify-center cursor-pointer shrink-0 overflow-hidden transition-colors ${
                  logoPreview
                    ? "border-primary/30"
                    : "border-dashed border-border hover:border-primary/40"
                }`}
                onClick={() => logoFileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleLogoFile(file);
                }}
              >
                {logoPreview && isSafeLogoUrl(logoPreview) ? (
                  <img
                    src={logoPreview}
                    alt="Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Upload className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="space-y-2 flex-1">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoFileRef.current?.click()}
                  >
                    <Upload className="h-3 w-3 mr-1.5" /> Upload Image
                  </Button>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setLogoPreview("");
                        setLogoUrl("");
                      }}
                    >
                      <X className="h-3 w-3 mr-1" /> Remove
                    </Button>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  PNG, JPG, WEBP · Max 2MB · Drag &amp; drop or click
                </p>
                {/* URL input as alternative */}
                <Input
                  placeholder="Or paste an image URL..."
                  value={logoUrl.startsWith("data:") ? "" : logoUrl}
                  onChange={(e) => {
                    setLogoUrl(e.target.value);
                    setLogoPreview(e.target.value);
                  }}
                  className="bg-muted border-border text-xs h-7"
                />
              </div>
              <input
                ref={logoFileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleLogoFile(f);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Branding */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <Palette className="h-4 w-4 text-violet-400" /> Branding
          </CardTitle>
          <CardDescription className="text-xs">
            Customize your organization's appearance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs">Accent Color</Label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 rounded cursor-pointer border-0 bg-transparent"
              />
              <Input
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="bg-muted border-border w-32 font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Billing */}
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="font-mono text-sm flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" /> Plan Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">Plan</span>
            <Badge className="bg-primary/20 text-primary border-primary/30">
              Enterprise
            </Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-mono">Seats</span>
            <span className="text-sm font-mono">
              {currentOrg._count.members} / {currentOrg.maxSeats}
            </span>
          </div>
          <Separator />
          <p className="text-xs text-muted-foreground">
            Plan is managed by the platform admin. Contact support to change
            your plan.
          </p>
        </CardContent>
      </Card>

      {/* Audit Log */}
      {(currentOrg.myRole === "OWNER" || currentOrg.myRole === "ADMIN") && (
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" /> Audit Log
            </CardTitle>
            <CardDescription className="text-xs">
              View a history of actions taken in your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="font-mono text-xs"
              onClick={() => navigate(`/org/${slug}/settings/audit`)}
            >
              <FileText className="h-3 w-3 mr-1.5" /> View Audit Log
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Email Templates */}
      {(currentOrg.myRole === "OWNER" || currentOrg.myRole === "ADMIN") && (
        <EmailTemplatesSection orgId={currentOrg.id} />
      )}

      {/* Data Privacy */}
      {(currentOrg.myRole === "OWNER" || currentOrg.myRole === "ADMIN") && (
        <DataPrivacySection slug={slug} />
      )}

      {/* Danger Zone */}
      {currentOrg.myRole === "OWNER" && (
        <Card className="bg-card border-destructive/30">
          <CardHeader>
            <CardTitle className="font-mono text-sm flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> Danger Zone
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              size="sm"
              className="border-destructive/50 text-destructive hover:bg-destructive/10 font-mono text-xs"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && (
                <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
              )}
              Delete Organization
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Save */}
      <div className="flex justify-end">
        <Button
          onClick={() => saveMutation.mutate()}
          className="glow-cyan"
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-1.5" />
          )}
          Save Changes
        </Button>
      </div>
    </div>
  );
};

// ─── Email Templates Section ──────────────────────────────────────────────────

const TRIGGER_LABELS: Record<EmailTrigger, string> = {
  INVITE: "Invitation sent",
  SHORTLISTED: "Candidate shortlisted",
  INTERVIEW: "Interview scheduled",
  REJECTED: "Candidate rejected",
  HIRED: "Candidate hired",
};

const EmailTemplatesSection = ({ orgId }: { orgId: string }) => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<EmailTrigger | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");

  const { data: templates, isLoading } = useQuery({
    queryKey: ["email-templates", orgId],
    queryFn: () => getEmailTemplates(orgId),
  });

  const upsertMutation = useMutation({
    mutationFn: () =>
      upsertEmailTemplate(orgId, editing!, { subject, bodyHtml }),
    onSuccess: () => {
      toast.success("Template saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["email-templates", orgId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Save failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: (trigger: EmailTrigger) => deleteEmailTemplate(orgId, trigger),
    onSuccess: () => {
      toast.success("Template reset to default");
      qc.invalidateQueries({ queryKey: ["email-templates", orgId] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Reset failed"),
  });

  const openEdit = (t: EmailTemplate) => {
    setEditing(t.trigger);
    setSubject(t.subject);
    setBodyHtml(t.bodyHtml);
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-mono text-sm flex items-center gap-2">
          <Mail className="h-4 w-4 text-primary" /> Email Templates
        </CardTitle>
        <CardDescription className="text-xs">
          Customise emails sent to candidates at each pipeline stage
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        ) : (
          (templates ?? []).map((t) => (
            <div
              key={t.trigger}
              className="flex items-center justify-between rounded-lg border border-border p-3"
            >
              <div className="space-y-0.5">
                <p className="font-mono text-xs font-semibold">
                  {TRIGGER_LABELS[t.trigger]}
                </p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[300px]">
                  {t.subject}
                </p>
                {t.isCustom && (
                  <Badge className="text-[9px] bg-primary/15 text-primary">
                    Custom
                  </Badge>
                )}
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs font-mono h-7"
                  onClick={() => openEdit(t)}
                >
                  Edit
                </Button>
                {t.isCustom && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    title="Reset to default"
                    onClick={() => deleteMutation.mutate(t.trigger)}
                    disabled={deleteMutation.isPending}
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))
        )}

        {/* Inline editor */}
        {editing && (
          <div className="rounded-lg border border-primary/30 bg-muted/40 p-4 space-y-3 mt-2">
            <p className="font-mono text-xs font-semibold text-primary">
              Editing: {TRIGGER_LABELS[editing]}
            </p>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="bg-muted border-border font-mono text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="font-mono text-xs">
                Body HTML{" "}
                <span className="text-muted-foreground">
                  (use {"{{candidateName}}"}, {"{{assessmentTitle}}"},{" "}
                  {"{{orgName}}"}, {"{{link}}"})
                </span>
              </Label>
              <textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                rows={6}
                className="w-full rounded-md border border-border bg-muted px-3 py-2 text-xs font-mono resize-y"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                className="font-mono text-xs"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="glow-cyan font-mono text-xs"
                onClick={() => upsertMutation.mutate()}
                disabled={upsertMutation.isPending || !subject || !bodyHtml}
              >
                {upsertMutation.isPending && (
                  <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                )}
                Save Template
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Data Privacy Section ─────────────────────────────────────────────────────

const DataPrivacySection = ({ slug }: { slug: string }) => {
  const currentOrg = useOrgStore((s) => s.currentOrg);
  const qc = useQueryClient();
  const [retentionMonths, setRetentionMonths] = useState(
    currentOrg?.dataRetentionMonths ?? 12,
  );

  const saveMutation = useMutation({
    mutationFn: () => updateOrg(slug, { dataRetentionMonths: retentionMonths }),
    onSuccess: () => {
      toast.success("Retention policy saved");
      qc.invalidateQueries({ queryKey: ["org", slug] });
    },
    onError: (e: any) =>
      toast.error(e?.response?.data?.message || "Save failed"),
  });

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="font-mono text-sm flex items-center gap-2">
          <Shield className="h-4 w-4 text-amber-400" /> Data Privacy
        </CardTitle>
        <CardDescription className="text-xs">
          Candidate data retention and PII anonymisation policy
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="font-mono text-xs">Retention Period (months)</Label>
          <div className="flex items-center gap-3">
            <Input
              type="number"
              min={1}
              max={84}
              value={retentionMonths}
              onChange={(e) => setRetentionMonths(Number(e.target.value))}
              className="bg-muted border-border w-24 font-mono"
            />
            <span className="text-xs text-muted-foreground font-mono">
              Candidate PII is anonymised after this period (or on deletion
              request)
            </span>
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground font-mono space-y-1">
          <p>
            <span className="text-foreground font-semibold">
              What is anonymised:
            </span>{" "}
            candidate email, name, and IP address.
          </p>
          <p>
            <span className="text-foreground font-semibold">When:</span> nightly
            job — candidates older than the retention period, or those who
            requested deletion.
          </p>
          <p>
            <span className="text-foreground font-semibold">What remains:</span>{" "}
            score, stage, and assessment metadata are kept for analytics.
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            className="glow-cyan font-mono text-xs"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending && (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            )}
            <Save className="h-3 w-3 mr-1.5" />
            Save Policy
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OrgSettings;
