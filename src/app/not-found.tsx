import { ContentPage, ContentTitle } from "@/components/wix/content/ContentPage";

export default function NotFound() {
  return (
    <ContentPage>
      <ContentTitle>Page not found</ContentTitle>
      <p className="wix-content-empty wix-content-empty-stories">The page you&apos;re looking for isn&apos;t here. Use the buttons below to go home or back to the family tree.</p>
    </ContentPage>
  );
}
