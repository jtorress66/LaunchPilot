import type { Calendar, ContentItem } from "@launchpilot/domain";
import Link from "next/link";
import { ContentStatusBadge } from "../content/content-status-badge";
import { channelName } from "./channel-name";
import { LocalTime } from "./local-time";

const dayLabel = (date: string) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));

function PostLine({ item }: { readonly item: ContentItem }) {
  const at = item.status === "published" ? item.publication?.at : item.publishAt;
  return (
    <li className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-semibold">{channelName(item.channel)}</span>
      {at ? (
        <span className="text-slate-500">
          <LocalTime iso={at.toISOString()} />
        </span>
      ) : null}
      <Link href={`/app/content/${item.id}`} className="min-w-0 truncate hover:underline">
        {item.title}
      </Link>
      <ContentStatusBadge status={item.status} />
    </li>
  );
}

/** The next two weeks (days in UTC), plus approved posts still waiting for a time. */
export function CalendarView({ calendar }: { readonly calendar: Calendar }) {
  return (
    <div className="space-y-6">
      <ol aria-label="Calendar" className="divide-y divide-slate-200 dark:divide-slate-800">
        {calendar.days.map((day) => (
          <li key={day.date} data-date={day.date} className="py-3">
            <h3 className="text-sm font-medium text-slate-500">{dayLabel(day.date)}</h3>
            {day.items.length === 0 ? null : (
              <ul className="mt-2 space-y-2">
                {day.items.map((item) => (
                  <PostLine key={item.id} item={item} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      <section aria-labelledby="unscheduled" className="space-y-2">
        <h3 id="unscheduled" className="font-semibold">
          Unscheduled
        </h3>
        {calendar.unscheduled.length === 0 ? (
          <p className="text-sm text-slate-500">Approved posts without a time appear here.</p>
        ) : (
          <ul className="space-y-2">
            {calendar.unscheduled.map((item) => (
              <PostLine key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
