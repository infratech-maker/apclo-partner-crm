import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      tenantId: string;
      organizationId: string | null;
      role: string;
      permissions: string[];
    };
  }

  interface User {
    id: string;
    email: string;
    name: string;
    tenantId: string;
    organizationId: string | null;
    role: string;
    permissions: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    tenantId: string;
    organizationId: string | null;
    role: string;
    permissions: string[];
  }
}

