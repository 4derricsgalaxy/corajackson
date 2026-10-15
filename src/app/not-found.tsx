import type { Metadata } from "next";
import { ContentPage, ContentTitle } from "@/components/wix/content/ContentPage";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <ContentPage>
      <ContentTitle>Page not found</ContentTitle>
      <p className="wix-content-empty wix-content-empty-stories">The page you&apos;re looking for isn&apos;t here. Use the Home or Family Tree button to find your way back.</p>
    </ContentPage>
  );
}
