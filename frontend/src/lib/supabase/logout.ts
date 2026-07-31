/**
 * Logout the current user
 * Calls the logout API endpoint and handles the response
 */
export async function logout(): Promise<void> {
  try {
    const response = await fetch("/auth/logout", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to log out");
    }

    // Success - the calling component should handle redirect
  } catch (error) {
    console.error("[Logout] Error:", error);
    throw error;
  }
}
