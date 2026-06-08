import { Footer } from "@/components/footer";

export default function CustomerPortalLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <>
      {children}
      <Footer variant="customer" />
    </>
  );
}
