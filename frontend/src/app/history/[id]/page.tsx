import { notFound } from "next/navigation";
import Link from "next/link";
import { getJob, getJobItems } from "@/lib/jobs";
import JobDetail from "@/components/history/JobDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function JobPage({ params }: PageProps) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) notFound();
  const items = getJobItems(id);

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-4">
      <div className="py-4">
        <Link
          href="/history"
          className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          &larr; Back to history
        </Link>
      </div>
      <JobDetail job={job} items={items} />
    </main>
  );
}
