# StudyPilot V4.2 – usability and interface update

This is an update to the supplied V4.1 redesign package. It keeps the existing Supabase schema and adds no new database tables.

## What's changed

### Student experience
- Removed the Learning Resources page, navigation item, dashboard shortcut, and student-side resource loading. The feature is deferred to a later release; the existing resource table and administrator resource tools are retained for now.
- Moved O Level/A Level and subject selection to a prominent panel at the top of Settings & Backup. Students can select multiple published subjects for their chosen level.
- Preserved previous local planner history and manual coverage marks when selected official subjects are refreshed or reselected.
- Added topic-level and subtopic-level coverage controls, alongside individual concept coverage and study-session logging.
- Reworked smartphone bottom navigation to keep Home, Curriculum, Plan, Review and Notices visible, with less-frequently used features grouped in a More menu.
- Added a shared dark/light theme toggle to the administration page and completed dark styling for forms, inputs, selects, textareas, curriculum panels, dialogs and mobile navigation.

### Administration
- Curriculum tree now provides Edit and Delete actions for individual concepts.
- Added batch concept entry by subtopic, with duplicate detection.
- Noticeboard publishing remains available in the admin dashboard, with clearer feedback when the V4.1 noticeboard migration has not been applied.
- Added an admin theme toggle that shares the theme preference with the student interface on the same browser.

## Database setup

No V4.2-specific SQL migration is required. The Noticeboard, student academic-level/subject selection, and concept-suggestion features depend on the existing `StudyPilot_V4_1_Noticeboard_Levels_Suggestions.sql` migration. If it has not already been run in your Supabase project, apply it before testing those features.

Do not rerun or replace your existing V4 migration blindly. Keep the existing Supabase project and its data.

## Deployment

1. Keep a copy of the currently deployed site files.
2. Compare the package `config.js` with the live site's config. This package intentionally contains placeholders. Preserve your real Supabase project URL and public publishable/anon key; never use a service-role or secret key in browser code.
3. Upload the updated student/admin HTML, JavaScript and CSS files to the same published root.
4. If V4.1 SQL has not yet been applied, run `StudyPilot_V4_1_Noticeboard_Levels_Suggestions.sql` in Supabase SQL Editor.
5. Test with one administrator account and one student account before announcing the update.

## Suggested test sequence

- Sign in as a student, open Settings & Backup, switch between O Level and A Level, and verify the subject choices change.
- Select subjects, save, refresh, and verify the selected level and subjects remain.
- Mark one concept, one subtopic and one topic as covered. Verify the marks update the relevant coverage summaries.
- Open More on a phone-sized screen and navigate to Availability, Exams, History, Reports, Suggestions and Settings.
- Switch dark mode on both student and admin pages. Check forms, dropdowns, dialogs, tables and navigation.
- Sign in as admin, publish a notice, then sign in as a student in the matching audience and confirm it appears and can be marked read.
- Edit, batch-add and delete a test concept in a test curriculum. Be careful: deleting an official concept can cascade-delete its row in `student_concept_progress`.

## Validation status

JavaScript syntax checks passed for `app.js`, `auth.js` and `admin.js`. Static file/markup checks were performed. This package has not been connected to or tested against your live Supabase project, so end-to-end database behavior still needs to be verified in your environment.
