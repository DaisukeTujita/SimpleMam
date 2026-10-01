import AuthGate from "@/components/auth-gate";
import MobileShell from "./shell";
export default function MobileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthGate>
      <MobileShell>{children}</MobileShell>
    </AuthGate>
  );
}
