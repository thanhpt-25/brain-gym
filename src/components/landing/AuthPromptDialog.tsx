import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface AuthPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where to send the visitor after they sign in. */
  redirectTo: string;
  title?: string;
  description?: string;
}

/**
 * A friendlier stand-in for the silent redirect-to-/auth that
 * <ProtectedRoute> performs. Explains *why* a visitor is being asked to sign
 * up before sending them there, instead of surprising them with a login form.
 */
export function AuthPromptDialog({
  open,
  onOpenChange,
  redirectTo,
  title = "Create a free account to continue",
  description = "Sign up in a few seconds to save your progress, track readiness, and unlock full explanations. No credit card required.",
}: AuthPromptDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            className="w-full font-mono"
            onClick={() =>
              navigate("/auth", { state: { from: { pathname: redirectTo } } })
            }
          >
            Create free account
          </Button>
          <Button
            variant="ghost"
            className="w-full font-mono"
            onClick={() => onOpenChange(false)}
          >
            Not now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
