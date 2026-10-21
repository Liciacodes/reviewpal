import type { Metadata } from "next";
import { PageHeader } from "@/components/PageHeader";
import { ConnectionCheck } from "./ConnectionCheck";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="How this dashboard connects to the ReviewPal server." />
      <ConnectionCheck />
    </>
  );
}
