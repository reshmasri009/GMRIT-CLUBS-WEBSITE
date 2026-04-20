type Props = {
  message: string;
};

export function ErrorBox({ message }: Props) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-center">
      <p className="font-semibold">Something went wrong</p>
      <p className="text-sm mt-1">{message}</p>
    </div>
  );
}