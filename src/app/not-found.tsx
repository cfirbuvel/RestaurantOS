export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
      <h2 className="text-2xl font-bold text-gray-900 mb-2">עמוד לא נמצא (404)</h2>
      <p className="text-sm text-gray-500 mb-4">העמוד שחיפשת אינו קיים במערכת RestaurantOS.</p>
      <a
        href="/"
        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
      >
        חזרה לדשבורד
      </a>
    </div>
  );
}
