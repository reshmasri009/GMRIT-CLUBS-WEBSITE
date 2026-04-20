export function Card({ children }: any) {
  return (
    <div className="p-4 rounded-2xl bg-card border shadow-sm">
      {children}
    </div>
  );
}