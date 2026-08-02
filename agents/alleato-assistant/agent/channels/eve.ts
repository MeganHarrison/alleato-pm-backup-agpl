import { eveChannel } from "eve/channels/eve";
import { localDev, type AuthFn } from "eve/channels/auth";
import { authenticateAlleatoRequest } from "../lib/auth.js";

const alleatoAuth: AuthFn<Request> = async (request) => {
  const user = await authenticateAlleatoRequest(request);
  if (!user) return null;

  return {
    attributes: {
      assistantTurnId: user.assistantTurnId,
      assistantSurface: user.assistantSurface,
      ...(user.email ? { email: user.email } : {}),
      ...(user.selectedProjectId === undefined
        ? {}
        : { selectedProjectId: String(user.selectedProjectId) }),
    },
    authenticator: "supabase",
    issuer: "alleato",
    principalId: user.id,
    principalType: "user",
  };
};

export default eveChannel({
  auth: [alleatoAuth, localDev()],
  uploadPolicy: "disabled",
});
