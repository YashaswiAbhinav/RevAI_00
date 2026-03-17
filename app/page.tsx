import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-gray-900 mb-6">
            Rev<span className="text-blue-600">AI</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            Intelligent Social Media Auto-Response System.
            Automate customer engagement on YouTube, Instagram, and Facebook with AI-powered responses.
          </p>
          <div className="space-x-4">
            <Link
              href="/auth/login"
              className="bg-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Get Started
            </Link>
            <Link
              href="/dashboard"
              className="bg-white text-blue-600 px-8 py-3 rounded-lg font-semibold border border-blue-600 hover:bg-blue-50 transition-colors"
            >
              Dashboard
            </Link>
          </div>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">🤖 AI-Powered Responses</h3>
            <p className="text-gray-600">
              Use Google Gemini AI to generate contextual, personalized replies to customer comments and questions.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">🔄 Automated Workflows</h3>
            <p className="text-gray-600">
              Apache Airflow orchestrates the entire pipeline from comment fetching to reply posting.
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4">📊 Smart Analytics</h3>
            <p className="text-gray-600">
              Generate comprehensive reports with insights on customer sentiment and engagement trends.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}