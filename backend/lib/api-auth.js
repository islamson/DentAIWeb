// Temporary auth helper for API routes
// This is a simplified version until NextAuth v5 is stable

// For now, we'll use a mock session
// In production, this would integrate with NextAuth properly
export async function getApiSession() {
  // Mock session for development
  // TODO: Replace with proper NextAuth v5 session handling
  return {
    user: {
      id: "demo-user-id",
      email: "admin@demo.com",
      name: "Demo User",
      organizationId: "org1",
      branchId: "branch1",
      role: "OWNER",
    },
  };
}

