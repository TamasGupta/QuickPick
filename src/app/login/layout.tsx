import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login or Sign Up",
  description:
    "Sign in to your GrabOn account or create one to start ordering fresh groceries delivered in minutes.",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
