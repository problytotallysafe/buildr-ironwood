BUILDR PROJECT MEDIA

Files included:
- src/app/(private)/projects/page.tsx
- src/app/(private)/projects/[id]/page.tsx
- src/components/project-media.tsx
- project-media.css

Installation:
1. Upload this ZIP into /workspaces/buildr-ironwood/buildr-ironwood-v1
2. Run:
   unzip -o buildr-project-media.zip
3. Append project-media.css to src/app/globals.css
4. Restart the dev server:
   pkill -f "next dev"
   npm run dev
5. Open Projects, click a project name, and test uploading a photo.

Database prerequisite:
The project_media table and project-media Supabase Storage bucket must already exist.
