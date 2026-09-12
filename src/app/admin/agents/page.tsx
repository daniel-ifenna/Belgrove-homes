import { prisma } from "@/lib/prisma";
import AgentManager from "./AgentManager";

export const dynamic = "force-dynamic";

export default async function AgentsPage() {
  const agents = await prisma.agent.findMany({
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
    include: { _count: { select: { bookings: true } } },
  });

  // Serialize dates for client component
  const serialized = agents.map((a) => ({
    ...a,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
  }));

  return <AgentManager initialAgents={serialized as unknown as never} />;
}
