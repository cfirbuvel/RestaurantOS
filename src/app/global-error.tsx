"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="he" dir="rtl">
      <body className="bg-white text-gray-900 flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <h2 className="text-2xl font-bold mb-2">אירעה שגיאה במערכת</h2>
        <p className="text-sm text-gray-500 mb-4">{error.message || "שגיאה בלתי צפויה"}</p>
        <button
          onClick={() => reset()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          נסה שוב
        </button>
      </body>
    </html>
  );
}
