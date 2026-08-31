import RoadmapApp from "@/components/RoadmapApp";
import { AuthGate } from "@/components/AuthGate";

export default function Page() {
  return (
    <AuthGate>
      <RoadmapApp />
    </AuthGate>
  );
}
