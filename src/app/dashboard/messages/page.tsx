"use client";

/**
 * /dashboard/messages — thin wrapper over the shared MessagesDashboard
 * (same chat engine as /message; both routes render the identical UI).
 */
import MessagesDashboard from "@/components/MessagesDashboard";

export default function DashboardMessagesPage() {
  return <MessagesDashboard />;
}
