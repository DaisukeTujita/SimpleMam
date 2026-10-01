import Rundown from "@/components/rundown";
export default async function MobileRundownPage({
  params,
  searchParams,
}: {
  params: Promise<{ programId: string }>;
  searchParams: Promise<{ on_air_date?: string }>;
}) {
  const { programId } = await params;
  const { on_air_date } = await searchParams;
  return (
    <Rundown
      id={Number(programId)}
      date={on_air_date === "undated" ? null : (on_air_date ?? "")}
      basePath="/mobile"
    />
  );
}
