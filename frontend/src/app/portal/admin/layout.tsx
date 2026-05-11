import { Footer } from "@/components/footer";

export default function AdminPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Footer variant="admin" />
    </>
  );
}
