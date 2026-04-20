export function PageWrapper({ title, children }: any) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </div>
  );
}