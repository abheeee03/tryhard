import { prisma } from "@/lib/prisma";

export async function GET() {
  const matches = await prisma.match.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      creator: true,
      players: {
        include: { user: true },
      },
      winner: true,
    },
  });
  return Response.json(matches);
}
