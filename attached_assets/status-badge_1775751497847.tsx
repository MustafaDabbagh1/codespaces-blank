import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StatusType =
  | "pending"
  | "approved"
  | "declined"
  | "voided"
  | "refunded"
  | "settled"
  | "active"
  | "inactive"
  | "live"
  | "suspended"
  | "draft"
  | "sent"
  | "paid"
  | "overdue"
  | "cancelled"
  | "open"
  | "closed"
  | "processing"
  | "shipped"
  | "delivered"
  | "returned"
  | "failed"
  | "success"
  | "lead"
  | "submitted"
  | "partial"
  | "disabled"
  | "completed"
  | "signed"
  | "awaiting_signature"
  | "issue";

const statusStyles: Record<StatusType, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  declined: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  voided: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  refunded: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  settled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  inactive: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  live: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  suspended: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  cancelled: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  closed: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  processing: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  shipped: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  delivered: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  returned: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  lead: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  disabled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  completed: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  signed: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  awaiting_signature: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  issue: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const normalizedStatus = status.toLowerCase() as StatusType;
  const style = statusStyles[normalizedStatus] || statusStyles.pending;

  const displayLabels: Partial<Record<StatusType, string>> = {
    suspended: "Deactivated",
    disabled: "Disabled",
    awaiting_signature: "Awaiting Signature",
    issue: "Issue",
  };

  const label = displayLabels[normalizedStatus] || status.replace(/_/g, " ");

  return (
    <Badge
      variant="secondary"
      className={cn(
        "font-medium border-0 capitalize",
        style,
        className
      )}
      data-testid={`status-${normalizedStatus}`}
    >
      {label}
    </Badge>
  );
}
