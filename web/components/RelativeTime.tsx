import { fullDate, timeAgo } from "@/lib/time";

// "3 min ago", with the full date on hover (title) and for machines (dateTime)
export function RelativeTime({ iso, className = "" }: { iso: string; className?: string }) {
  return (
    <time dateTime={iso} title={fullDate(iso)} className={className}>
      {timeAgo(iso)}
    </time>
  );
}
