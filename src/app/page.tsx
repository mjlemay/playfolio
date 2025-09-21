
export default function Home() {
  return (
    <div className="font-sans max-w-6xl mx-auto p-8 space-y-8 bg-gray-900 min-h-screen">
            {/* Header */}
      <header className="text-center py-12 bg-gray-800 border border-gray-700 rounded-lg shadow-lg mb-8">
        <h1 className="text-5xl font-bold text-gray-200 mb-4">🎯 Playfolio API</h1>
        <p className="text-xl text-gray-300 max-w-2xl mx-auto">
          Comprehensive REST API for managing players, clubs, squads, activities, and devices with full CRUD operations and relational data support.
        </p>
        <div className="mt-6">
          <a href="#endpoints" className="inline-block bg-gray-700 hover:bg-gray-600 text-white px-6 py-3 rounded-lg font-semibold transition-colors">
            📚 View REST API Documentation
          </a>
        </div>
      </header>

      {/* Players API */}
      <section id="endpoints" className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-blue-400 mb-4">👤 Players API</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/players</span>
            <span className="text-gray-200">List all players</span>
            <span className="text-sm text-gray-400">Returns array of player objects</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-blue-400 font-semibold">POST /api/players</span>
            <span className="text-gray-200">Create new player</span>
            <span className="text-sm text-gray-400">Requires: uid, pin</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/players/[uid]</span>
            <span className="text-gray-200">Get player with memberships</span>
            <span className="text-sm text-gray-400">Includes club & squad memberships</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-yellow-400 font-semibold">PUT /api/players/[uid]</span>
            <span className="text-gray-200">Update player</span>
            <span className="text-sm text-gray-400">Updates meta, status, pin</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-red-400 font-semibold">DELETE /api/players/[uid]</span>
            <span className="text-gray-200">Delete player</span>
            <span className="text-sm text-gray-400">Removes all memberships</span>
          </div>
        </div>
      </section>

      {/* Clubs API */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-purple-400 mb-4">🏢 Clubs API</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/clubs</span>
            <span className="text-gray-200">List all clubs</span>
            <span className="text-sm text-gray-400">Returns array of club objects</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-blue-400 font-semibold">POST /api/clubs</span>
            <span className="text-gray-200">Create new club</span>
            <span className="text-sm text-gray-400">Requires: prefix</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/clubs/[uid]</span>
            <span className="text-gray-200">Get club with members</span>
            <span className="text-sm text-gray-400">Includes member list with roles</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-yellow-400 font-semibold">PUT /api/clubs/[uid]</span>
            <span className="text-gray-200">Update club</span>
            <span className="text-sm text-gray-400">Updates prefix, meta, status</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-red-400 font-semibold">DELETE /api/clubs/[uid]</span>
            <span className="text-gray-200">Delete club</span>
            <span className="text-sm text-gray-400">Removes all memberships</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-purple-300 mt-6 mb-3">Club Members Management</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-purple-900/30 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/clubs/[uid]/members</span>
            <span className="text-gray-200">Get club members</span>
            <span className="text-sm text-gray-400">Returns members with roles</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-purple-900/30 rounded">
            <span className="font-mono text-blue-400 font-semibold">POST /api/clubs/[uid]/members</span>
            <span className="text-gray-200">Add player to club</span>
            <span className="text-sm text-gray-400">Requires: player_uid, role</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-purple-900/30 rounded">
            <span className="font-mono text-yellow-400 font-semibold">PUT /api/clubs/[uid]/members/[playerUid]</span>
            <span className="text-gray-200">Update membership</span>
            <span className="text-sm text-gray-400">Updates role, status</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-purple-900/30 rounded">
            <span className="font-mono text-red-400 font-semibold">DELETE /api/clubs/[uid]/members/[playerUid]</span>
            <span className="text-gray-200">Remove from club</span>
            <span className="text-sm text-gray-400">Removes player membership</span>
          </div>
        </div>
      </section>

      {/* Squads API */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-orange-400 mb-4">⚽ Squads API</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/squads</span>
            <span className="text-gray-200">List all squads</span>
            <span className="text-sm text-gray-400">Returns array of squad objects</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-blue-400 font-semibold">POST /api/squads</span>
            <span className="text-gray-200">Create new squad</span>
            <span className="text-sm text-gray-400">Requires: uid</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/squads/[uid]</span>
            <span className="text-gray-200">Get squad with members</span>
            <span className="text-sm text-gray-400">Includes positions & jersey numbers</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-yellow-400 font-semibold">PUT /api/squads/[uid]</span>
            <span className="text-gray-200">Update squad</span>
            <span className="text-sm text-gray-400">Updates status, meta</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-red-400 font-semibold">DELETE /api/squads/[uid]</span>
            <span className="text-gray-200">Delete squad</span>
            <span className="text-sm text-gray-400">Removes all memberships</span>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-orange-300 mt-6 mb-3">Squad Members Management</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-orange-900/30 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/squads/[uid]/members</span>
            <span className="text-gray-200">Get squad members</span>
            <span className="text-sm text-gray-400">Returns members with positions</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-orange-900/30 rounded">
            <span className="font-mono text-blue-400 font-semibold">POST /api/squads/[uid]/members</span>
            <span className="text-gray-200">Add player to squad</span>
            <span className="text-sm text-gray-400">Requires: player_uid, position, jersey_number</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-orange-900/30 rounded">
            <span className="font-mono text-yellow-400 font-semibold">PUT /api/squads/[uid]/members/[playerUid]</span>
            <span className="text-gray-200">Update membership</span>
            <span className="text-sm text-gray-400">Updates position, jersey, status</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-orange-900/30 rounded">
            <span className="font-mono text-red-400 font-semibold">DELETE /api/squads/[uid]/members/[playerUid]</span>
            <span className="text-gray-200">Remove from squad</span>
            <span className="text-sm text-gray-400">Removes player membership</span>
          </div>
        </div>
      </section>

      {/* Activities API */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-green-400 mb-4">📊 Activities API</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/activities</span>
            <span className="text-gray-200">List all activities</span>
            <span className="text-sm text-gray-400">Returns array of activity objects</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-blue-400 font-semibold">POST /api/activities</span>
            <span className="text-gray-200">Create new activity</span>
            <span className="text-sm text-gray-400">Requires: player_uid, club_id, format</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/activities/[uid]</span>
            <span className="text-gray-200">Get activity details</span>
            <span className="text-sm text-gray-400">Includes player, club, device info</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-yellow-400 font-semibold">PUT /api/activities/[uid]</span>
            <span className="text-gray-200">Update activity</span>
            <span className="text-sm text-gray-400">Updates meta, format, device</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-red-400 font-semibold">DELETE /api/activities/[uid]</span>
            <span className="text-gray-200">Delete activity</span>
            <span className="text-sm text-gray-400">Permanently removes activity</span>
          </div>
        </div>
      </section>

      {/* Devices API */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-indigo-400 mb-4">📱 Devices API</h2>
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/devices</span>
            <span className="text-gray-200">List all devices</span>
            <span className="text-sm text-gray-400">Returns array of device objects</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-blue-400 font-semibold">POST /api/devices</span>
            <span className="text-gray-200">Create new device</span>
            <span className="text-sm text-gray-400">Requires: name, club_id</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-green-400 font-semibold">GET /api/devices/[uid]</span>
            <span className="text-gray-200">Get device details</span>
            <span className="text-sm text-gray-400">Includes club info & recent activities</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-yellow-400 font-semibold">PUT /api/devices/[uid]</span>
            <span className="text-gray-200">Update device</span>
            <span className="text-sm text-gray-400">Updates name, club_id</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-3 bg-gray-700 rounded">
            <span className="font-mono text-red-400 font-semibold">DELETE /api/devices/[uid]</span>
            <span className="text-gray-200">Delete device</span>
            <span className="text-sm text-gray-400">Permanently removes device</span>
          </div>
        </div>
      </section>

      {/* Data Types */}
      <section className="bg-gray-800 border border-gray-700 rounded-lg p-6 shadow-lg">
        <h2 className="text-2xl font-semibold text-gray-200 mb-4">📋 Data Types & Status Values</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-3">Attendance Status</h3>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="font-mono text-sm text-gray-200">present</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="font-mono text-sm text-gray-200">absent</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-gray-900 border border-gray-500 rounded-full"></span>
                <span className="font-mono text-sm text-gray-200">banned</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-gray-400 rounded-full"></span>
                <span className="font-mono text-sm text-gray-200">unknown</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 bg-yellow-500 rounded-full"></span>
                <span className="font-mono text-sm text-gray-200">inactive</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-3">Response Format</h3>
            <div className="bg-gray-900 p-4 rounded font-mono text-sm">
              <div className="text-green-400">{`// Success Response`}</div>
              <div className="text-gray-200">&#123;</div>
              <div className="ml-2 text-gray-200">&quot;success&quot;: <span className="text-blue-400">true</span>,</div>
              <div className="ml-2 text-gray-200">&quot;data&quot;: &#123;...&#125;,</div>
              <div className="ml-2 text-gray-200">&quot;count&quot;: <span className="text-blue-400">10</span></div>
              <div className="text-gray-200">&#125;</div>
              <br />
              <div className="text-red-400">{`// Error Response`}</div>
              <div className="text-gray-200">&#123;</div>
              <div className="ml-2 text-gray-200">&quot;success&quot;: <span className="text-red-400">false</span>,</div>
              <div className="ml-2 text-gray-200">&quot;error&quot;: <span className="text-yellow-400">&quot;Error message&quot;</span></div>
              <div className="text-gray-200">&#125;</div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-8 text-gray-400">
        <p>Playfolio API v1.0 - Built with Next.js, Drizzle ORM, and PostgreSQL</p>
      </footer>
    </div>
  );
}
