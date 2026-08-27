# Kyle's Catalog

A simple preorder website with:
- Public catalog
- Name + item preorder form
- Daily availability
- Automatic reset after midnight (America/New_York)
- Admin login
- Add/edit/delete catalog items
- Admin preorder list
- Manual availability reset

## Run it

1. Install Node.js 20+.
2. Open a terminal in this folder.
3. Run:
   npm install
4. Set a real admin password:
   - Windows PowerShell: `$env:ADMIN_PASSWORD="your-password"`
   - macOS/Linux: `export ADMIN_PASSWORD="your-password"`
5. Start:
   npm start
6. Open `http://localhost:3000`

## Important for a real public website

This app needs to run on a server/host so multiple people can use it. SQLite is fine for a small project, but the database file should be stored on persistent disk.

Before publishing, change the admin password environment variable. The default `change-me-now` is only for local testing.

For a school/friend project with a small number of users, this is intentionally simple.