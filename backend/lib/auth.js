import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("E-posta ve şifre gerekli");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            orgs: {
              include: {
                organization: true,
                branch: true,
              },
            },
          },
        });

        if (!user) {
          throw new Error("Kullanıcı bulunamadı");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);

        if (!isValid) {
          throw new Error("Geçersiz şifre");
        }

        // Return user with first org context
        const firstOrg = user.orgs[0];

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: firstOrg?.organizationId,
          branchId: firstOrg?.branchId,
          role: firstOrg?.role,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.organizationId = user.organizationId;
        token.branchId = user.branchId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id;
        session.user.organizationId = token.organizationId;
        session.user.branchId = token.branchId;
        session.user.role = token.role;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};

