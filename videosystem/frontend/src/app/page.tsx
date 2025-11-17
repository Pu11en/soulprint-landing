export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ViraCut MVP
        </h1>
        <p className="text-lg text-gray-600 mb-8">
          Mobile-first node-based video editing platform
        </p>
        <div className="space-y-4">
          <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded">
            <p className="font-medium">Phase 1: Setup Complete</p>
            <p className="text-sm mt-1">
              Project structure and basic configuration established
            </p>
          </div>
          <div className="bg-gray-100 border-l-4 border-gray-500 text-gray-700 p-4 rounded">
            <p className="font-medium">Next Steps</p>
            <ul className="text-sm mt-1 text-left">
              <li>• Set up Supabase backend</li>
              <li>• Implement authentication</li>
              <li>• Create video editor components</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}