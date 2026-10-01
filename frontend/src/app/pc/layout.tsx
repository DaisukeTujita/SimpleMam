import AuthGate from "@/components/auth-gate";
import PcShell from "./shell";
export default function PcLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <PcShell>{children}</PcShell>
    </AuthGate>
  );
}
