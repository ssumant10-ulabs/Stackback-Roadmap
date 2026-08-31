import PilotsApp from "@/components/PilotsApp";
import { AuthGate } from "@/components/AuthGate";

export default function Page() {
  return (
    <AuthGate>
      <PilotsApp />
    </AuthGate>
  );
}
