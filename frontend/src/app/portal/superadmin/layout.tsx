import { Footer } from "@/components/footer";

export default function SuperadminPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Footer variant="superadmin" />
    </>
  );
}
