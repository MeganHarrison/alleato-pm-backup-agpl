import { useCurrentUserProfile } from "@/hooks/use-current-user-profile";

export const useCurrentUserName = () => {
  const { profile } = useCurrentUserProfile();
  return profile?.fullName || profile?.email?.split("@")[0] || "Unknown user";
};
