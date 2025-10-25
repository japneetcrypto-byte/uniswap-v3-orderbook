import { OrderbookPage } from "@/components/OrderbookPage"; // ← Changed from default to named

export default function Page({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const chain = (searchParams?.chain as string) || "";
  const pool = (searchParams?.pool as string) || "";
  const mode = (searchParams?.mode as string) || "simple";

  return <OrderbookPage initialChain={chain} initialPool={pool} initialMode={mode} />;
}
