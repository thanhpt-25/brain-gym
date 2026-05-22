import { useAuthStore } from "@/stores/auth.store";
import { CoachSession } from "./CoachSession";
import { CoachLockState } from "./CoachLockState";

export function Coach() {
  const { user } = useAuthStore();

  if (!user) {
    return <CoachLockState />;
  }

  const isPremium = user.plan?.toUpperCase() === "PREMIUM";

  if (!isPremium) {
    return <CoachLockState />;
  }

  return <CoachSession userId={user.id} />;
}
