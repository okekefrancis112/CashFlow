export function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#06060b] flex items-center justify-center animate-fade-in">
      <div className="relative">
        <div className="w-10 h-10 rounded-full border-2 border-white/[0.06]" />
        <div className="absolute inset-0 w-10 h-10 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <div className="absolute inset-0 w-10 h-10 rounded-full animate-pulse-glow" />
      </div>
    </div>
  );
}
