// apps/dashboard/src/app/api/generation/projects/[project_id]/assets/route.ts
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: { project_id: string } }
) {
  const { project_id } = params;

  // TODO: Implement actual logic to fetch assets from the database
  // For now, we return an empty array to prevent client-side errors.

  console.log(`[API STUB] Requested assets for project: ${project_id}`);

  return NextResponse.json([]); // <--- Возвращаем пустой массив
}
