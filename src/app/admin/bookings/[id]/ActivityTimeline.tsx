import { statusLabels } from "@/lib/booking-ui";
import { actionLabels, type BookingAction } from "@/lib/booking-transitions";
import { formatDateTime } from "@/lib/booking-ui";

type Activity = {
  id: string;
  actorName: string;
  action: string;
  fromStatus: string;
  toStatus: string;
  note: string | null;
  emailSent: boolean | null;
  emailError: string | null;
  createdAt: Date;
};

export default function ActivityTimeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return null;

  return (
    <div className="bg-white border border-stone-200 rounded-lg p-6 mt-6">
      <h2 className="text-sm font-medium text-stone-500 mb-4">Activity</h2>
      <ol className="space-y-4">
        {activities.map((a) => (
          <li key={a.id} className="border-l-2 border-stone-200 pl-4 relative">
            <span className="absolute -left-[5px] top-1 w-2 h-2 rounded-full bg-stone-400" />
            <div className="flex items-baseline justify-between gap-4">
              <p className="text-sm text-stone-800">
                <span className="font-medium">{a.actorName}</span>{" "}
                {actionLabels[a.action as BookingAction]?.toLowerCase() ?? a.action}
                {a.fromStatus !== a.toStatus && (
                  <span className="text-stone-500">
                    {" "}
                    ({statusLabels[a.fromStatus]} → {statusLabels[a.toStatus]})
                  </span>
                )}
              </p>
              <span className="text-xs text-stone-400 shrink-0">{formatDateTime(a.createdAt)}</span>
            </div>
            {a.note && <p className="text-sm text-stone-500 mt-1 whitespace-pre-wrap">{a.note}</p>}
            {a.emailSent === true && <p className="text-xs text-emerald-600 mt-1">Email sent</p>}
            {a.emailSent === false && (
              <p className="text-xs text-red-600 mt-1">Email failed: {a.emailError}</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
